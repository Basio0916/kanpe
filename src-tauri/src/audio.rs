use crate::state::{save_sessions_to_disk, AppSettings, AppState, CaptionEntry};
use chrono::Local;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, Stream, StreamConfig};
use futures_util::{SinkExt, StreamExt};
use std::collections::{HashMap, VecDeque};
use std::process::Stdio;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{broadcast, mpsc};
use tokio::task::JoinHandle;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::protocol::Message;

#[cfg(target_os = "macos")]
const SYS_AUDIO_CAPTURE_SWIFT: &str = include_str!("../scripts/sys_audio_capture.swift");

const SCREEN_CAPTURE_SAMPLE_RATE: u32 = 16_000;
const MIX_SAMPLE_RATE: u32 = 16_000;
const MIX_CHUNK_FRAMES: usize = 320;
const MAX_QUEUE_DRAIN_CHUNKS: usize = 32;
const MAX_MIX_BACKLOG_MS: usize = 1_200;
const MAX_MIX_BACKLOG_FRAMES: usize = (MIX_SAMPLE_RATE as usize * MAX_MIX_BACKLOG_MS) / 1_000;
const KEEP_ALIVE_INTERVAL_SECS: u64 = 3;
const KEEP_ALIVE_PAYLOAD: &str = r#"{"type":"KeepAlive"}"#;
const FINALIZE_PAYLOAD: &str = r#"{"type":"Finalize"}"#;
const LATENCY_WARN_THRESHOLD_MS: f64 = 1_500.0;
const LATENCY_WARN_STEP_MS: f64 = 500.0;
const MIX_DIAGNOSTIC_LOG_INTERVAL_SECS: u64 = 1;
const DBFS_FLOOR: f64 = -120.0;

pub struct RecordingRuntime {
    pub stop_tx: broadcast::Sender<()>,
    pub tasks: Vec<JoinHandle<()>>,
}

enum SourceKind {
    Device {
        device: cpal::Device,
        device_name: String,
    },
    ScreenCaptureKit,
}

struct SourceSpec {
    label: &'static str,
    kind: SourceKind,
}

struct SourceCapture {
    sample_rate: u32,
    audio_rx: mpsc::UnboundedReceiver<Vec<i16>>,
    handle: CaptureHandle,
}

enum CaptureHandle {
    Cpal(Stream),
    ScreenCaptureKit {
        child: Child,
        stdout_task: JoinHandle<()>,
        stderr_task: JoinHandle<()>,
    },
}

#[derive(Default)]
struct StreamLatencyMonitor {
    last_warn_bucket: Option<u64>,
    latest_lag_ms: Option<f64>,
}

impl StreamLatencyMonitor {
    fn observe(&mut self, audio_cursor_seconds: f64, transcript_cursor_seconds: Option<f64>) {
        let Some(transcript_cursor_seconds) = transcript_cursor_seconds else {
            return;
        };

        let lag_ms = ((audio_cursor_seconds - transcript_cursor_seconds) * 1_000.0).max(0.0);
        self.latest_lag_ms = Some(lag_ms);
        if lag_ms < LATENCY_WARN_THRESHOLD_MS {
            self.last_warn_bucket = None;
            return;
        }

        let bucket = (lag_ms / LATENCY_WARN_STEP_MS).floor() as u64;
        if self.last_warn_bucket == Some(bucket) {
            return;
        }
        self.last_warn_bucket = Some(bucket);
        log::warn!(
            "Deepgram lag detected: {:.0}ms (audio_cursor={:.2}s, transcript_cursor={:.2}s)",
            lag_ms,
            audio_cursor_seconds,
            transcript_cursor_seconds
        );
    }

    fn latest_lag_ms(&self) -> Option<f64> {
        self.latest_lag_ms
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum DominantSource {
    Mic,
    Sys,
    Balanced,
    Unknown,
}

impl DominantSource {
    fn as_str(self) -> &'static str {
        match self {
            Self::Mic => "MIC",
            Self::Sys => "SYS",
            Self::Balanced => "BALANCED",
            Self::Unknown => "UNKNOWN",
        }
    }
}

struct MixDiagnostics {
    window_start: Instant,
    mic_db_sum: f64,
    mic_db_count: usize,
    sys_db_sum: f64,
    sys_db_count: usize,
    last_dominant: DominantSource,
}

impl MixDiagnostics {
    fn new() -> Self {
        Self {
            window_start: Instant::now(),
            mic_db_sum: 0.0,
            mic_db_count: 0,
            sys_db_sum: 0.0,
            sys_db_count: 0,
            last_dominant: DominantSource::Unknown,
        }
    }

    fn observe_mic(&mut self, samples: &[i16]) {
        let db = rms_dbfs(samples);
        self.mic_db_sum += db;
        self.mic_db_count += 1;
    }

    fn observe_sys(&mut self, samples: &[i16]) {
        let db = rms_dbfs(samples);
        self.sys_db_sum += db;
        self.sys_db_count += 1;
    }

    fn emit_if_due(
        &mut self,
        mic_buffer_frames: usize,
        sys_buffer_frames: usize,
        deepgram_lag_ms: Option<f64>,
    ) {
        if self.window_start.elapsed() < Duration::from_secs(MIX_DIAGNOSTIC_LOG_INTERVAL_SECS) {
            return;
        }

        let mic_db_avg = if self.mic_db_count > 0 {
            self.mic_db_sum / self.mic_db_count as f64
        } else {
            DBFS_FLOOR
        };
        let sys_db_avg = if self.sys_db_count > 0 {
            self.sys_db_sum / self.sys_db_count as f64
        } else {
            DBFS_FLOOR
        };

        let dominant = detect_dominant_source(mic_db_avg, sys_db_avg);
        if dominant != self.last_dominant {
            log::info!(
                "Mix dominant changed: {} -> {} (mic_avg={:.1}dBFS, sys_avg={:.1}dBFS)",
                self.last_dominant.as_str(),
                dominant.as_str(),
                mic_db_avg,
                sys_db_avg
            );
            self.last_dominant = dominant;
        }

        let lag_text = deepgram_lag_ms
            .map(|v| format!("{:.0}", v))
            .unwrap_or_else(|| "n/a".to_string());

        log::info!(
            "Mix diag: mic_avg={:.1}dBFS sys_avg={:.1}dBFS dominant={} mic_buf={}ms sys_buf={}ms dg_lag={}ms mic_samples={} sys_samples={}",
            mic_db_avg,
            sys_db_avg,
            dominant.as_str(),
            frames_to_ms(mic_buffer_frames),
            frames_to_ms(sys_buffer_frames),
            lag_text,
            self.mic_db_count,
            self.sys_db_count
        );

        self.window_start = Instant::now();
        self.mic_db_sum = 0.0;
        self.mic_db_count = 0;
        self.sys_db_sum = 0.0;
        self.sys_db_count = 0;
    }
}

pub fn start_live_caption_runtime(
    app: AppHandle,
    session_id: String,
) -> Result<RecordingRuntime, String> {
    let deepgram_api_key = std::env::var("DEEPGRAM_API_KEY")
        .map_err(|_| "環境変数 DEEPGRAM_API_KEY が未設定です".to_string())?;

    let settings = {
        let state = app.state::<AppState>();
        let guard = state.settings.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    let host = cpal::default_host();
    let mut sources = Vec::new();
    let mut mic_name = String::new();

    if let Some((mic_device, detected_name)) = select_microphone_device(&host, &settings) {
        mic_name = detected_name.clone();
        sources.push(SourceSpec {
            label: "MIC",
            kind: SourceKind::Device {
                device: mic_device,
                device_name: detected_name,
            },
        });
    } else {
        log::warn!("Microphone input device was not found. Continuing without MIC source.");
    }

    if settings.system_audio.to_lowercase() == "screen_capture" {
        sources.push(SourceSpec {
            label: "SYS",
            kind: SourceKind::ScreenCaptureKit,
        });
        log::info!("Using ScreenCaptureKit for system audio capture");
    } else if let Some((sys_device, sys_name)) =
        select_system_audio_device(&host, &mic_name, &settings)
    {
        log::info!("Using system audio input device: {}", sys_name);
        sources.push(SourceSpec {
            label: "SYS",
            kind: SourceKind::Device {
                device: sys_device,
                device_name: sys_name,
            },
        });
    } else {
        log::warn!(
            "System audio source was not found. screen_capture mode is recommended on macOS, otherwise install/select a loopback device."
        );
    }

    if sources.is_empty() {
        return Err(
            "利用可能な音声入力ソースがありません。マイク/画面収録権限または入力設定を確認してください。"
                .to_string(),
        );
    }

    let (stop_tx, _) = broadcast::channel::<()>(16);
    emit_connection_status(&app, "reconnecting");

    let app_clone = app.clone();
    let session_id_clone = session_id;
    let settings_clone = settings;
    let key_clone = deepgram_api_key;
    let stop_rx = stop_tx.subscribe();

    let handle = tokio::task::spawn_blocking(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build();
        let Ok(runtime) = runtime else {
            log::error!("Failed to create runtime for mixed capture stream");
            emit_connection_status(&app_clone, "disconnected");
            return;
        };

        runtime.block_on(async move {
            if let Err(err) = run_mixed_stream(
                app_clone.clone(),
                session_id_clone,
                sources,
                key_clone,
                settings_clone,
                stop_rx,
            )
            .await
            {
                log::error!("Mixed capture stream failed: {}", err);
                emit_connection_status(&app_clone, "disconnected");
            }
        });
    });

    Ok(RecordingRuntime {
        stop_tx,
        tasks: vec![handle],
    })
}

fn select_system_audio_device(
    host: &cpal::Host,
    mic_name: &str,
    settings: &AppSettings,
) -> Option<(cpal::Device, String)> {
    let devices = host.input_devices().ok()?;
    let mic_name_lower = mic_name.to_lowercase();

    let mut candidates: Vec<(cpal::Device, String)> = devices
        .filter_map(|d| {
            let name = d.name().ok()?;
            if name.to_lowercase() == mic_name_lower {
                return None;
            }
            Some((d, name))
        })
        .collect();

    if candidates.is_empty() {
        return None;
    }

    let configured = settings.system_audio.to_lowercase();

    if configured != "screen_capture" && configured != "virtual_audio" && !configured.is_empty() {
        if let Some(idx) = candidates
            .iter()
            .position(|(_, name)| name.to_lowercase().contains(&configured))
        {
            return Some(candidates.swap_remove(idx));
        }
    }

    let keywords = [
        "blackhole",
        "loopback",
        "soundflower",
        "vb-audio",
        "virtual",
        "background music",
    ];

    if let Some(idx) = candidates.iter().position(|(_, name)| {
        let lower = name.to_lowercase();
        keywords.iter().any(|kw| lower.contains(kw))
    }) {
        return Some(candidates.swap_remove(idx));
    }

    None
}

fn select_microphone_device(
    host: &cpal::Host,
    settings: &AppSettings,
) -> Option<(cpal::Device, String)> {
    let configured = settings.mic_input.trim().to_lowercase();
    let use_default = configured.is_empty() || configured == "default";

    if !use_default {
        if let Ok(devices) = host.input_devices() {
            for device in devices {
                let Ok(name) = device.name() else {
                    continue;
                };
                if name.to_lowercase().contains(&configured) {
                    return Some((device, name));
                }
            }
        }
        log::warn!(
            "Configured mic_input '{}' was not found. Falling back to default input device.",
            settings.mic_input
        );
    }

    let device = host.default_input_device()?;
    let name = device
        .name()
        .unwrap_or_else(|_| "Default Input".to_string());
    Some((device, name))
}

async fn run_mixed_stream(
    app: AppHandle,
    session_id: String,
    sources: Vec<SourceSpec>,
    deepgram_api_key: String,
    settings: AppSettings,
    mut stop_rx: broadcast::Receiver<()>,
) -> Result<(), String> {
    let mut captures: Vec<SourceCapture> = Vec::new();
    for source in &sources {
        match setup_capture_source(source).await {
            Ok(capture) => captures.push(capture),
            Err(err) => {
                log::warn!(
                    "{} capture setup failed and was skipped: {}",
                    source.label,
                    err
                );
            }
        }
    }

    if captures.is_empty() {
        return Err(
            "有効な音声入力ソースを初期化できませんでした。権限と入力デバイス設定を確認してください。"
                .to_string(),
        );
    }

    let language = if settings.stt_language.trim().is_empty() {
        "en".to_string()
    } else {
        settings.stt_language.clone()
    };

    let ws_url = format!(
        "wss://api.deepgram.com/v1/listen?encoding=linear16&channels=1&sample_rate={}&model={}&language={}&interim_results={}&endpointing={}&diarize=true&punctuate=true&smart_format=true&no_delay=true",
        MIX_SAMPLE_RATE,
        settings.stt_model,
        language,
        settings.interim_results,
        settings.endpointing
    );

    let mut request = match ws_url.into_client_request() {
        Ok(request) => request,
        Err(err) => {
            shutdown_all_captures(captures).await;
            return Err(format!("websocket request error: {}", err));
        }
    };
    let auth = format!("Token {}", deepgram_api_key);
    let auth_header = match tokio_tungstenite::tungstenite::http::HeaderValue::from_str(&auth) {
        Ok(header) => header,
        Err(err) => {
            shutdown_all_captures(captures).await;
            return Err(err.to_string());
        }
    };
    request.headers_mut().insert("Authorization", auth_header);

    let (ws_stream, _) = match connect_async(request).await {
        Ok(stream) => stream,
        Err(err) => {
            shutdown_all_captures(captures).await;
            return Err(format!("Deepgram connection error: {}", err));
        }
    };

    emit_connection_status(&app, "connected");
    let (mut ws_writer, mut ws_reader) = ws_stream.split();

    log::info!(
        "Mixed stream started (sources: {}, sample_rate: {})",
        captures.len(),
        MIX_SAMPLE_RATE
    );

    while captures.len() > 2 {
        if let Some(extra) = captures.pop() {
            log::warn!("Dropping extra capture source beyond first 2");
            shutdown_capture(extra.handle).await;
        }
    }

    let stream_result = if captures.len() == 1 {
        let capture = captures.remove(0);
        run_single_capture_loop(
            &app,
            &session_id,
            &mut stop_rx,
            &mut ws_writer,
            &mut ws_reader,
            capture,
        )
        .await
    } else {
        let primary = captures.remove(0);
        let secondary = captures.remove(0);
        run_mixed_capture_loop(
            &app,
            &session_id,
            &mut stop_rx,
            &mut ws_writer,
            &mut ws_reader,
            primary,
            secondary,
        )
        .await
    };

    if let Err(err) = send_control_message(&mut ws_writer, FINALIZE_PAYLOAD).await {
        log::debug!("Deepgram Finalize send skipped: {}", err);
    }
    let _ = ws_writer.send(Message::Close(None)).await;

    emit_connection_status(&app, "disconnected");
    log::info!("Mixed stream stopped");
    stream_result
}

async fn run_single_capture_loop<W, R>(
    app: &AppHandle,
    session_id: &str,
    stop_rx: &mut broadcast::Receiver<()>,
    ws_writer: &mut W,
    ws_reader: &mut R,
    capture: SourceCapture,
) -> Result<(), String>
where
    W: futures_util::sink::Sink<Message> + Unpin,
    W::Error: std::fmt::Display,
    R: futures_util::stream::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>>
        + Unpin,
{
    let source_rate = capture.sample_rate;
    let mut audio_rx = capture.audio_rx;
    let handle = capture.handle;
    let mut keep_alive_tick = tokio::time::interval(Duration::from_secs(KEEP_ALIVE_INTERVAL_SECS));
    keep_alive_tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    keep_alive_tick.tick().await;
    let mut sent_audio_since_keepalive = false;
    let mut sent_samples = 0usize;
    let mut dropped_chunks = 0usize;
    let mut last_drop_log = Instant::now();
    let mut latency_monitor = StreamLatencyMonitor::default();

    let loop_result: Result<(), String> = loop {
        tokio::select! {
            _ = stop_rx.recv() => break Ok(()),
            maybe_pcm = audio_rx.recv() => {
                let Some(pcm) = maybe_pcm else {
                    break Ok(());
                };
                let (latest_pcm, dropped) = drain_audio_backlog(&mut audio_rx, pcm);
                dropped_chunks += dropped;
                if dropped_chunks > 0 && last_drop_log.elapsed() >= Duration::from_secs(2) {
                    log::warn!(
                        "MIC audio backlog detected: dropped {} queued chunks to keep captions near real-time",
                        dropped_chunks
                    );
                    dropped_chunks = 0;
                    last_drop_log = Instant::now();
                }

                let mixed = resample_i16_mono(&latest_pcm, source_rate, MIX_SAMPLE_RATE);
                if mixed.is_empty() {
                    continue;
                }
                ws_writer
                    .send(Message::Binary(pcm_i16_to_le_bytes(&mixed)))
                    .await
                    .map_err(|e| format!("websocket write error: {}", e))?;
                sent_samples += mixed.len();
                sent_audio_since_keepalive = true;
            }
            _ = keep_alive_tick.tick() => {
                if !sent_audio_since_keepalive {
                    send_control_message(ws_writer, KEEP_ALIVE_PAYLOAD)
                        .await
                        .map_err(|e| format!("websocket keepalive error: {}", e))?;
                }
                sent_audio_since_keepalive = false;
            }
            incoming = ws_reader.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        let audio_cursor_seconds = audio_cursor_seconds(sent_samples);
                        if let Err(err) = handle_deepgram_text_message(
                            app,
                            session_id,
                            &text,
                            audio_cursor_seconds,
                            &mut latency_monitor,
                        ) {
                            log::warn!("transcript parse error: {}", err);
                        }
                    }
                    Some(Ok(Message::Close(_))) => break Ok(()),
                    Some(Ok(_)) => {}
                    Some(Err(err)) => break Err(format!("websocket read error: {}", err)),
                    None => break Ok(()),
                }
            }
        }
    };

    shutdown_capture(handle).await;

    loop_result
}

async fn run_mixed_capture_loop<W, R>(
    app: &AppHandle,
    session_id: &str,
    stop_rx: &mut broadcast::Receiver<()>,
    ws_writer: &mut W,
    ws_reader: &mut R,
    primary: SourceCapture,
    secondary: SourceCapture,
) -> Result<(), String>
where
    W: futures_util::sink::Sink<Message> + Unpin,
    W::Error: std::fmt::Display,
    R: futures_util::stream::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>>
        + Unpin,
{
    let mut rx_primary = primary.audio_rx;
    let mut rx_secondary = secondary.audio_rx;

    let rate_primary = primary.sample_rate;
    let rate_secondary = secondary.sample_rate;
    let primary_handle = primary.handle;
    let secondary_handle = secondary.handle;
    let mut buf_primary = VecDeque::<i16>::new();
    let mut buf_secondary = VecDeque::<i16>::new();
    let mut primary_closed = false;
    let mut secondary_closed = false;
    let mut tick = tokio::time::interval(Duration::from_millis(20));
    tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut keep_alive_tick = tokio::time::interval(Duration::from_secs(KEEP_ALIVE_INTERVAL_SECS));
    keep_alive_tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    keep_alive_tick.tick().await;
    let mut sent_audio_since_keepalive = false;
    let mut sent_samples = 0usize;
    let mut dropped_primary_chunks = 0usize;
    let mut dropped_secondary_chunks = 0usize;
    let mut dropped_primary_frames = 0usize;
    let mut dropped_secondary_frames = 0usize;
    let mut last_drop_log = Instant::now();
    let mut latency_monitor = StreamLatencyMonitor::default();
    let mut mix_diagnostics = MixDiagnostics::new();

    let loop_result: Result<(), String> = loop {
        tokio::select! {
            _ = stop_rx.recv() => break Ok(()),
            maybe_pcm = rx_primary.recv(), if !primary_closed => {
                match maybe_pcm {
                    Some(pcm) => {
                        let (latest_pcm, dropped) = drain_audio_backlog(&mut rx_primary, pcm);
                        dropped_primary_chunks += dropped;
                        let resampled = resample_i16_mono(&latest_pcm, rate_primary, MIX_SAMPLE_RATE);
                        mix_diagnostics.observe_mic(&resampled);
                        dropped_primary_frames +=
                            extend_buffer_with_cap(&mut buf_primary, &resampled, MAX_MIX_BACKLOG_FRAMES);
                    }
                    None => {
                        primary_closed = true;
                    }
                }
            }
            maybe_pcm = rx_secondary.recv(), if !secondary_closed => {
                match maybe_pcm {
                    Some(pcm) => {
                        let (latest_pcm, dropped) = drain_audio_backlog(&mut rx_secondary, pcm);
                        dropped_secondary_chunks += dropped;
                        let resampled = resample_i16_mono(&latest_pcm, rate_secondary, MIX_SAMPLE_RATE);
                        mix_diagnostics.observe_sys(&resampled);
                        dropped_secondary_frames +=
                            extend_buffer_with_cap(&mut buf_secondary, &resampled, MAX_MIX_BACKLOG_FRAMES);
                    }
                    None => {
                        secondary_closed = true;
                    }
                }
            }
            _ = tick.tick() => {
                if let Some(mixed) = mix_two_buffers(&mut buf_primary, &mut buf_secondary, MIX_CHUNK_FRAMES) {
                    ws_writer
                        .send(Message::Binary(pcm_i16_to_le_bytes(&mixed)))
                        .await
                        .map_err(|e| format!("websocket write error: {}", e))?;
                    sent_samples += mixed.len();
                    sent_audio_since_keepalive = true;
                }

                if last_drop_log.elapsed() >= Duration::from_secs(2) {
                    if dropped_primary_chunks > 0 || dropped_secondary_chunks > 0 || dropped_primary_frames > 0 || dropped_secondary_frames > 0 {
                        log::warn!(
                            "Audio backlog trimmed (MIC: {} chunks / {} frames, SYS: {} chunks / {} frames)",
                            dropped_primary_chunks,
                            dropped_primary_frames,
                            dropped_secondary_chunks,
                            dropped_secondary_frames
                        );
                        dropped_primary_chunks = 0;
                        dropped_secondary_chunks = 0;
                        dropped_primary_frames = 0;
                        dropped_secondary_frames = 0;
                    }
                    last_drop_log = Instant::now();
                }

                mix_diagnostics.emit_if_due(
                    buf_primary.len(),
                    buf_secondary.len(),
                    latency_monitor.latest_lag_ms(),
                );

                if primary_closed && secondary_closed && buf_primary.is_empty() && buf_secondary.is_empty() {
                    break Ok(());
                }
            }
            _ = keep_alive_tick.tick() => {
                if !sent_audio_since_keepalive {
                    send_control_message(ws_writer, KEEP_ALIVE_PAYLOAD)
                        .await
                        .map_err(|e| format!("websocket keepalive error: {}", e))?;
                }
                sent_audio_since_keepalive = false;
            }
            incoming = ws_reader.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        let audio_cursor_seconds = audio_cursor_seconds(sent_samples);
                        if let Err(err) = handle_deepgram_text_message(
                            app,
                            session_id,
                            &text,
                            audio_cursor_seconds,
                            &mut latency_monitor,
                        ) {
                            log::warn!("transcript parse error: {}", err);
                        }
                    }
                    Some(Ok(Message::Close(_))) => break Ok(()),
                    Some(Ok(_)) => {}
                    Some(Err(err)) => break Err(format!("websocket read error: {}", err)),
                    None => break Ok(()),
                }
            }
        }
    };

    shutdown_capture(primary_handle).await;
    shutdown_capture(secondary_handle).await;

    loop_result
}

async fn setup_capture_source(source: &SourceSpec) -> Result<SourceCapture, String> {
    match &source.kind {
        SourceKind::Device {
            device,
            device_name,
        } => setup_device_capture(source.label, device.clone(), device_name.clone()).await,
        SourceKind::ScreenCaptureKit => {
            #[cfg(target_os = "macos")]
            {
                setup_screencapturekit_capture(source.label).await
            }

            #[cfg(not(target_os = "macos"))]
            {
                Err("ScreenCaptureKit is only available on macOS".to_string())
            }
        }
    }
}

async fn setup_device_capture(
    label: &str,
    device: cpal::Device,
    device_name: String,
) -> Result<SourceCapture, String> {
    let default_config = device
        .default_input_config()
        .map_err(|e| format!("{} default input config error: {}", label, e))?;
    let sample_format = default_config.sample_format();
    let config: StreamConfig = default_config.clone().into();
    let sample_rate = config.sample_rate.0;
    let channels = config.channels;

    let (audio_tx, audio_rx) = mpsc::unbounded_channel::<Vec<i16>>();

    let capture_stream = build_capture_stream(&device, &config, sample_format, label, audio_tx)?;

    capture_stream
        .play()
        .map_err(|e| format!("{} stream play error: {}", label, e))?;

    log::info!(
        "{} device capture started (device: {}, sample_rate: {}, channels: {})",
        label,
        device_name,
        sample_rate,
        channels
    );

    Ok(SourceCapture {
        sample_rate,
        audio_rx,
        handle: CaptureHandle::Cpal(capture_stream),
    })
}

#[cfg(target_os = "macos")]
async fn setup_screencapturekit_capture(label: &str) -> Result<SourceCapture, String> {
    let script_path = write_sys_audio_capture_script()?;

    let mut child = Command::new("swift")
        .arg(script_path)
        .arg("--sample-rate")
        .arg(SCREEN_CAPTURE_SAMPLE_RATE.to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "{} failed to launch ScreenCaptureKit helper via swift: {}",
                label, e
            )
        })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| format!("{} failed to capture helper stdout", label))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| format!("{} failed to capture helper stderr", label))?;

    let (audio_tx, audio_rx) = mpsc::unbounded_channel::<Vec<i16>>();
    let label_stdout = label.to_string();
    let stdout_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        let mut chunk = [0u8; 4096];
        let mut pending = Vec::<u8>::new();

        loop {
            match reader.read(&mut chunk).await {
                Ok(0) => break,
                Ok(n) => {
                    pending.extend_from_slice(&chunk[..n]);
                    let complete_len = pending.len() - (pending.len() % 2);
                    if complete_len == 0 {
                        continue;
                    }

                    let mut pcm = Vec::with_capacity(complete_len / 2);
                    for bytes in pending[..complete_len].chunks_exact(2) {
                        pcm.push(i16::from_le_bytes([bytes[0], bytes[1]]));
                    }
                    pending.drain(..complete_len);

                    if audio_tx.send(pcm).is_err() {
                        break;
                    }
                }
                Err(err) => {
                    log::error!(
                        "{} ScreenCaptureKit stdout read error: {}",
                        label_stdout,
                        err
                    );
                    break;
                }
            }
        }
    });

    let label_stderr = label.to_string();
    let stderr_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if line.is_empty() {
                continue;
            }
            log::info!("{} ScreenCaptureKit: {}", label_stderr, line);
        }
    });

    Ok(SourceCapture {
        sample_rate: SCREEN_CAPTURE_SAMPLE_RATE,
        audio_rx,
        handle: CaptureHandle::ScreenCaptureKit {
            child,
            stdout_task,
            stderr_task,
        },
    })
}

#[cfg(target_os = "macos")]
fn write_sys_audio_capture_script() -> Result<std::path::PathBuf, String> {
    let path = std::env::temp_dir().join("kanpe_sys_audio_capture.swift");
    std::fs::write(&path, SYS_AUDIO_CAPTURE_SWIFT).map_err(|e| {
        format!(
            "failed to write ScreenCaptureKit helper script to {}: {}",
            path.display(),
            e
        )
    })?;
    Ok(path)
}

async fn shutdown_capture(handle: CaptureHandle) {
    match handle {
        CaptureHandle::Cpal(stream) => {
            drop(stream);
        }
        CaptureHandle::ScreenCaptureKit {
            mut child,
            stdout_task,
            stderr_task,
        } => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            stdout_task.abort();
            stderr_task.abort();
        }
    }
}

async fn shutdown_all_captures(captures: Vec<SourceCapture>) {
    for capture in captures {
        shutdown_capture(capture.handle).await;
    }
}

fn build_capture_stream(
    device: &cpal::Device,
    config: &StreamConfig,
    sample_format: SampleFormat,
    source_label: &str,
    audio_tx: mpsc::UnboundedSender<Vec<i16>>,
) -> Result<Stream, String> {
    let channels = config.channels;
    let label = source_label.to_string();
    let error_callback = move |err| {
        log::error!("{} input stream error: {}", label, err);
    };

    match sample_format {
        SampleFormat::I16 => device
            .build_input_stream(
                config,
                move |data: &[i16], _| {
                    let mono = interleaved_to_mono_i16(data, channels);
                    let _ = audio_tx.send(mono);
                },
                error_callback,
                None,
            )
            .map_err(|e| e.to_string()),
        SampleFormat::U16 => device
            .build_input_stream(
                config,
                move |data: &[u16], _| {
                    let mono = interleaved_to_mono_i16(data, channels);
                    let _ = audio_tx.send(mono);
                },
                error_callback,
                None,
            )
            .map_err(|e| e.to_string()),
        SampleFormat::F32 => device
            .build_input_stream(
                config,
                move |data: &[f32], _| {
                    let mono = interleaved_to_mono_i16(data, channels);
                    let _ = audio_tx.send(mono);
                },
                error_callback,
                None,
            )
            .map_err(|e| e.to_string()),
        other => Err(format!("unsupported sample format: {:?}", other)),
    }
}

fn interleaved_to_mono_i16<T>(input: &[T], channels: u16) -> Vec<i16>
where
    T: cpal::Sample + Copy,
    i16: FromSample<T>,
{
    let ch = channels.max(1) as usize;

    if ch == 1 {
        return input
            .iter()
            .map(|&sample| i16::from_sample(sample))
            .collect();
    }

    let mut mono = Vec::with_capacity(input.len() / ch);
    for frame in input.chunks(ch) {
        let sum: i32 = frame
            .iter()
            .map(|&sample| i16::from_sample(sample) as i32)
            .sum();
        mono.push((sum / frame.len() as i32) as i16);
    }
    mono
}

fn resample_i16_mono(input: &[i16], from_rate: u32, to_rate: u32) -> Vec<i16> {
    if input.is_empty() {
        return Vec::new();
    }
    if from_rate == to_rate || from_rate == 0 || to_rate == 0 {
        return input.to_vec();
    }

    let ratio = to_rate as f64 / from_rate as f64;
    let output_len = ((input.len() as f64) * ratio).round().max(1.0) as usize;
    let mut out = Vec::with_capacity(output_len);

    for i in 0..output_len {
        let src_pos = (i as f64) / ratio;
        let src_idx = src_pos.floor() as usize;
        let src_next = (src_idx + 1).min(input.len().saturating_sub(1));
        let frac = src_pos - (src_idx as f64);
        let a = input[src_idx] as f64;
        let b = input[src_next] as f64;
        let sample = a + (b - a) * frac;
        out.push(sample.round() as i16);
    }

    out
}

fn mix_two_buffers(
    primary: &mut VecDeque<i16>,
    secondary: &mut VecDeque<i16>,
    chunk_frames: usize,
) -> Option<Vec<i16>> {
    let available = primary.len().max(secondary.len());
    if available == 0 {
        return None;
    }

    let frames = available.min(chunk_frames).max(1);
    let mut out = Vec::with_capacity(frames);
    for _ in 0..frames {
        let a = primary.pop_front().unwrap_or(0) as i32;
        let b = secondary.pop_front().unwrap_or(0) as i32;
        let mixed = ((a + b) / 2).clamp(i16::MIN as i32, i16::MAX as i32) as i16;
        out.push(mixed);
    }

    Some(out)
}

fn audio_cursor_seconds(sent_samples: usize) -> f64 {
    sent_samples as f64 / MIX_SAMPLE_RATE as f64
}

fn extract_transcript_cursor_seconds(value: &serde_json::Value) -> Option<f64> {
    let start = value.get("start").and_then(|v| v.as_f64())?;
    let duration = value
        .get("duration")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    Some((start + duration).max(0.0))
}

fn drain_audio_backlog(
    rx: &mut mpsc::UnboundedReceiver<Vec<i16>>,
    first_chunk: Vec<i16>,
) -> (Vec<i16>, usize) {
    let mut latest = first_chunk;
    let mut dropped = 0usize;

    for _ in 0..MAX_QUEUE_DRAIN_CHUNKS {
        match rx.try_recv() {
            Ok(chunk) => {
                latest = chunk;
                dropped += 1;
            }
            Err(_) => break,
        }
    }

    (latest, dropped)
}

fn extend_buffer_with_cap(buffer: &mut VecDeque<i16>, samples: &[i16], max_frames: usize) -> usize {
    if samples.is_empty() {
        return 0;
    }

    buffer.extend(samples.iter().copied());
    if buffer.len() <= max_frames {
        return 0;
    }

    let overflow = buffer.len() - max_frames;
    buffer.drain(..overflow);
    overflow
}

fn rms_dbfs(samples: &[i16]) -> f64 {
    if samples.is_empty() {
        return DBFS_FLOOR;
    }

    let power_sum = samples
        .iter()
        .map(|&s| {
            let v = s as f64;
            v * v
        })
        .sum::<f64>();
    let rms = (power_sum / samples.len() as f64).sqrt();
    if rms <= 0.0 {
        return DBFS_FLOOR;
    }

    let full_scale = i16::MAX as f64;
    let normalized = (rms / full_scale).clamp(1e-9, 1.0);
    (20.0 * normalized.log10()).max(DBFS_FLOOR)
}

fn detect_dominant_source(mic_db_avg: f64, sys_db_avg: f64) -> DominantSource {
    let delta = mic_db_avg - sys_db_avg;
    if delta > 3.0 {
        DominantSource::Mic
    } else if delta < -3.0 {
        DominantSource::Sys
    } else {
        DominantSource::Balanced
    }
}

fn frames_to_ms(frames: usize) -> usize {
    frames.saturating_mul(1_000) / MIX_SAMPLE_RATE as usize
}

fn pcm_i16_to_le_bytes(samples: &[i16]) -> Vec<u8> {
    let mut out = Vec::with_capacity(samples.len() * 2);
    for sample in samples {
        out.extend_from_slice(&sample.to_le_bytes());
    }
    out
}

fn handle_deepgram_text_message(
    app: &AppHandle,
    session_id: &str,
    text: &str,
    audio_cursor_seconds: f64,
    latency_monitor: &mut StreamLatencyMonitor,
) -> Result<(), String> {
    let value: serde_json::Value = serde_json::from_str(text).map_err(|e| e.to_string())?;

    let is_results = value.get("type").and_then(|v| v.as_str()) == Some("Results");
    if !is_results {
        return Ok(());
    }

    latency_monitor.observe(
        audio_cursor_seconds,
        extract_transcript_cursor_seconds(&value),
    );

    let transcript = value
        .pointer("/channel/alternatives/0/transcript")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    if transcript.is_empty() {
        return Ok(());
    }

    let status = if value
        .get("is_final")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        "final"
    } else {
        "interim"
    };

    let source = extract_speaker_label(&value);

    append_and_emit_caption(app, session_id, source, status, transcript)
}

fn extract_speaker_label(value: &serde_json::Value) -> &str {
    let mut counter: HashMap<i64, usize> = HashMap::new();

    if let Some(words) = value
        .pointer("/channel/alternatives/0/words")
        .and_then(|v| v.as_array())
    {
        for word in words {
            if let Some(spk) = word.get("speaker").and_then(|v| v.as_i64()) {
                *counter.entry(spk).or_insert(0) += 1;
            }
        }
    }

    if let Some((speaker_id, _)) = counter.into_iter().max_by_key(|(_, count)| *count) {
        return match speaker_id {
            0 => "SPK1",
            1 => "SPK2",
            2 => "SPK3",
            3 => "SPK4",
            _ => "SPK",
        };
    }

    "SPK"
}

fn append_and_emit_caption(
    app: &AppHandle,
    session_id: &str,
    source: &str,
    status: &str,
    text: &str,
) -> Result<(), String> {
    let entry = CaptionEntry {
        time: Local::now().format("%H:%M:%S").to_string(),
        source: source.to_string(),
        status: status.to_string(),
        text: text.to_string(),
    };

    {
        let state = app.state::<AppState>();
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
            let should_replace_last_interim = session
                .captions
                .last()
                .map(|c| c.status == "interim")
                .unwrap_or(false);
            if should_replace_last_interim {
                if let Some(last) = session.captions.last_mut() {
                    *last = entry.clone();
                }
            } else {
                session.captions.push(entry.clone());
            }
            if status == "final" {
                save_sessions_to_disk(&sessions)?;
            }
        }
    }

    app.emit("caption", &entry).map_err(|e| e.to_string())
}

async fn send_control_message<W>(ws_writer: &mut W, payload: &str) -> Result<(), String>
where
    W: futures_util::sink::Sink<Message> + Unpin,
    W::Error: std::fmt::Display,
{
    ws_writer
        .send(Message::Text(payload.to_string().into()))
        .await
        .map_err(|e| e.to_string())
}

pub fn emit_connection_status(app: &AppHandle, status: &str) {
    let _ = app.emit(
        "connection",
        serde_json::json!({
            "status": status
        }),
    );
}
