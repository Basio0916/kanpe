use crate::state::{save_sessions_to_disk, AppSettings, AppState, CaptionEntry};
use chrono::Local;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, Stream, StreamConfig};
use std::collections::VecDeque;
use std::process::Stdio;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{broadcast, mpsc, oneshot};
use tokio::task::JoinHandle;

#[cfg(target_os = "macos")]
const SYS_AUDIO_CAPTURE_SWIFT: &str = include_str!("../scripts/sys_audio_capture.swift");
const FASTER_WHISPER_STREAM_PY: &str = include_str!("../scripts/faster_whisper_stream.py");

const SCREEN_CAPTURE_SAMPLE_RATE: u32 = 16_000;
const MIX_SAMPLE_RATE: u32 = 16_000;
const MIX_CHUNK_FRAMES: usize = 320;
const MAX_QUEUE_DRAIN_CHUNKS: usize = 32;
const MAX_MIX_BACKLOG_MS: usize = 1_200;
const MAX_MIX_BACKLOG_FRAMES: usize = (MIX_SAMPLE_RATE as usize * MAX_MIX_BACKLOG_MS) / 1_000;
const MIX_DIAGNOSTIC_LOG_INTERVAL_SECS: u64 = 1;
const DBFS_FLOOR: f64 = -120.0;
const DEFAULT_STT_PROVIDER: &str = "faster-whisper";
const DEFAULT_FASTER_WHISPER_MODEL: &str = "small";
const DEFAULT_FASTER_WHISPER_LANGUAGE: &str = "en";
const DEFAULT_STT_SOURCE: &str = "SPK";
const FASTER_WHISPER_STARTUP_TIMEOUT_SECS: u64 = 180;

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

#[derive(Clone, Copy)]
enum SttProvider {
    FasterWhisper,
}

impl SttProvider {
    fn from_settings(settings: &AppSettings) -> Result<Self, String> {
        let raw = if settings.stt_provider.trim().is_empty() {
            DEFAULT_STT_PROVIDER
        } else {
            settings.stt_provider.trim()
        };
        let normalized = raw.to_ascii_lowercase().replace('_', "-");
        match normalized.as_str() {
            "faster-whisper" => Ok(Self::FasterWhisper),
            _ => Err(format!(
                "Unsupported STT provider '{}'. Supported providers: faster-whisper",
                raw
            )),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::FasterWhisper => "faster-whisper",
        }
    }
}

enum SttRuntimeHandle {
    FasterWhisper {
        child: Child,
        stdin_task: JoinHandle<()>,
        stdout_task: JoinHandle<()>,
        stderr_task: JoinHandle<()>,
    },
}

struct SttRuntime {
    provider: SttProvider,
    audio_tx: mpsc::UnboundedSender<Vec<i16>>,
    handle: SttRuntimeHandle,
}

async fn shutdown_failed_faster_whisper_startup(
    mut child: Child,
    stdin_task: JoinHandle<()>,
    stdout_task: JoinHandle<()>,
    stderr_task: JoinHandle<()>,
    audio_tx: mpsc::UnboundedSender<Vec<i16>>,
) {
    drop(audio_tx);
    let _ = tokio::time::timeout(Duration::from_secs(1), stdin_task).await;
    let child_exited = tokio::time::timeout(Duration::from_secs(2), child.wait())
        .await
        .is_ok();
    if !child_exited {
        let _ = child.start_kill();
        let _ = child.wait().await;
    }
    stdout_task.abort();
    stderr_task.abort();
}

impl SttRuntime {
    fn send_audio(&self, samples: Vec<i16>) -> Result<(), String> {
        self.audio_tx.send(samples).map_err(|_| {
            format!(
                "{} transcription runtime is no longer available",
                self.provider.as_str()
            )
        })
    }

    fn latest_lag_ms(&self) -> Option<f64> {
        None
    }

    async fn shutdown(self) {
        drop(self.audio_tx);
        match self.handle {
            SttRuntimeHandle::FasterWhisper {
                mut child,
                stdin_task,
                stdout_task,
                stderr_task,
            } => {
                let _ = tokio::time::timeout(Duration::from_secs(1), stdin_task).await;
                let child_exited = tokio::time::timeout(Duration::from_secs(2), child.wait())
                    .await
                    .is_ok();
                if !child_exited {
                    let _ = child.start_kill();
                    let _ = child.wait().await;
                }
                let _ = tokio::time::timeout(Duration::from_secs(1), stdout_task).await;
                stderr_task.abort();
            }
        }
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
        stt_lag_ms: Option<f64>,
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

        let lag_text = stt_lag_ms
            .map(|v| format!("{:.0}", v))
            .unwrap_or_else(|| "n/a".to_string());

        log::info!(
            "Mix diag: mic_avg={:.1}dBFS sys_avg={:.1}dBFS dominant={} mic_buf={}ms sys_buf={}ms stt_lag={}ms mic_samples={} sys_samples={}",
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

async fn start_stt_runtime(
    app: AppHandle,
    session_id: String,
    settings: &AppSettings,
) -> Result<SttRuntime, String> {
    match SttProvider::from_settings(settings)? {
        SttProvider::FasterWhisper => {
            let script_path = write_faster_whisper_stream_script()?;
            let model = effective_stt_model(settings);
            let language = effective_stt_language(settings);
            let python_bin = std::env::var("WHISPER_PYTHON_BIN")
                .ok()
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| "python3".to_string());
            let chunk_ms = effective_chunk_ms(settings).to_string();

            let mut child = Command::new(&python_bin)
                .arg("-u")
                .arg(script_path)
                .arg("--sample-rate")
                .arg(MIX_SAMPLE_RATE.to_string())
                .arg("--model")
                .arg(model)
                .arg("--language")
                .arg(language)
                .arg("--chunk-ms")
                .arg(chunk_ms)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| {
                    format!(
                        "Failed to start faster-whisper helper via '{}': {}",
                        python_bin, e
                    )
                })?;

            let stdin = child
                .stdin
                .take()
                .ok_or_else(|| "faster-whisper helper stdin is unavailable".to_string())?;
            let stdout = child
                .stdout
                .take()
                .ok_or_else(|| "faster-whisper helper stdout is unavailable".to_string())?;
            let stderr = child
                .stderr
                .take()
                .ok_or_else(|| "faster-whisper helper stderr is unavailable".to_string())?;

            let (audio_tx, mut audio_rx) = mpsc::unbounded_channel::<Vec<i16>>();
            let (startup_tx, startup_rx) = oneshot::channel::<Result<(), String>>();
            let stdin_task = tokio::spawn(async move {
                let mut writer = stdin;
                while let Some(chunk) = audio_rx.recv().await {
                    if chunk.is_empty() {
                        continue;
                    }
                    let bytes = pcm_i16_to_le_bytes(&chunk);
                    if writer.write_all(&bytes).await.is_err() {
                        break;
                    }
                }
                let _ = writer.shutdown().await;
            });

            let app_for_stdout = app.clone();
            let session_for_stdout = session_id.clone();
            let stdout_task = tokio::spawn(async move {
                let mut startup_tx = Some(startup_tx);
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    if line.trim().is_empty() {
                        continue;
                    }

                    let value: serde_json::Value = match serde_json::from_str(&line) {
                        Ok(v) => v,
                        Err(err) => {
                            log::warn!("faster-whisper stdout parse error: {}", err);
                            continue;
                        }
                    };

                    let event_type = value
                        .get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or_default();

                    if event_type == "ready" {
                        if let Some(tx) = startup_tx.take() {
                            let _ = tx.send(Ok(()));
                        }
                        continue;
                    }

                    if event_type == "error" {
                        let message = value
                            .get("message")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown faster-whisper error")
                            .to_string();
                        if let Some(tx) = startup_tx.take() {
                            let _ = tx.send(Err(message.clone()));
                        }
                        log::error!("faster-whisper helper error: {}", message);
                        return;
                    }

                    if let Err(err) = handle_faster_whisper_stdout_value(
                        &app_for_stdout,
                        &session_for_stdout,
                        &value,
                    ) {
                        log::warn!("faster-whisper stdout parse error: {}", err);
                    }
                }

                if let Some(tx) = startup_tx.take() {
                    let _ = tx.send(Err(
                        "faster-whisper helper terminated before signaling readiness".to_string(),
                    ));
                }
            });

            let stderr_task = tokio::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    if line.trim().is_empty() {
                        continue;
                    }
                    log::info!("faster-whisper: {}", line);
                }
            });

            let startup_result = match tokio::time::timeout(
                Duration::from_secs(FASTER_WHISPER_STARTUP_TIMEOUT_SECS),
                startup_rx,
            )
            .await
            {
                Ok(Ok(Ok(()))) => Ok(()),
                Ok(Ok(Err(err))) => Err(format!(
                    "faster-whisper helper initialization failed: {}",
                    err
                )),
                Ok(Err(_)) => Err(
                    "faster-whisper helper terminated before initialization completed".to_string(),
                ),
                Err(_) => Err(format!(
                    "timed out waiting for faster-whisper helper initialization ({}s)",
                    FASTER_WHISPER_STARTUP_TIMEOUT_SECS
                )),
            };

            if let Err(err) = startup_result {
                shutdown_failed_faster_whisper_startup(
                    child,
                    stdin_task,
                    stdout_task,
                    stderr_task,
                    audio_tx,
                )
                .await;
                return Err(err);
            }

            Ok(SttRuntime {
                provider: SttProvider::FasterWhisper,
                audio_tx,
                handle: SttRuntimeHandle::FasterWhisper {
                    child,
                    stdin_task,
                    stdout_task,
                    stderr_task,
                },
            })
        }
    }
}

async fn run_mixed_stream(
    app: AppHandle,
    session_id: String,
    sources: Vec<SourceSpec>,
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

    let stt_provider = SttProvider::from_settings(&settings)?;
    let stt_runtime = match start_stt_runtime(app.clone(), session_id.clone(), &settings).await {
        Ok(runtime) => runtime,
        Err(err) => {
            shutdown_all_captures(captures).await;
            return Err(err);
        }
    };

    emit_connection_status(&app, "connected");
    log::info!(
        "Mixed stream started (provider: {}, sources: {}, sample_rate: {})",
        stt_provider.as_str(),
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
        run_single_capture_loop(&mut stop_rx, &stt_runtime, capture).await
    } else {
        let primary = captures.remove(0);
        let secondary = captures.remove(0);
        run_mixed_capture_loop(&mut stop_rx, &stt_runtime, primary, secondary).await
    };

    stt_runtime.shutdown().await;
    emit_connection_status(&app, "disconnected");
    log::info!("Mixed stream stopped");
    stream_result
}

async fn run_single_capture_loop(
    stop_rx: &mut broadcast::Receiver<()>,
    stt_runtime: &SttRuntime,
    capture: SourceCapture,
) -> Result<(), String> {
    let source_rate = capture.sample_rate;
    let mut audio_rx = capture.audio_rx;
    let handle = capture.handle;
    let mut dropped_chunks = 0usize;
    let mut last_drop_log = Instant::now();

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
                stt_runtime.send_audio(mixed)?;
            }
        }
    };

    shutdown_capture(handle).await;
    loop_result
}

async fn run_mixed_capture_loop(
    stop_rx: &mut broadcast::Receiver<()>,
    stt_runtime: &SttRuntime,
    primary: SourceCapture,
    secondary: SourceCapture,
) -> Result<(), String> {
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
    let mut dropped_primary_chunks = 0usize;
    let mut dropped_secondary_chunks = 0usize;
    let mut dropped_primary_frames = 0usize;
    let mut dropped_secondary_frames = 0usize;
    let mut last_drop_log = Instant::now();
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
                    stt_runtime.send_audio(mixed)?;
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
                    stt_runtime.latest_lag_ms(),
                );

                if primary_closed && secondary_closed && buf_primary.is_empty() && buf_secondary.is_empty() {
                    break Ok(());
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

fn effective_chunk_ms(settings: &AppSettings) -> u32 {
    if settings.utterance_end_ms == 0 {
        return 1_000;
    }
    settings.utterance_end_ms.clamp(1_000, 5_000)
}

fn effective_stt_language(settings: &AppSettings) -> String {
    if settings.stt_language.trim().is_empty() {
        return DEFAULT_FASTER_WHISPER_LANGUAGE.to_string();
    }
    settings.stt_language.trim().to_string()
}

fn effective_stt_model(settings: &AppSettings) -> String {
    let candidate = if !settings.stt_model.trim().is_empty() {
        settings.stt_model.trim().to_string()
    } else if let Ok(from_env) = std::env::var("FASTER_WHISPER_MODEL") {
        if !from_env.trim().is_empty() {
            from_env.trim().to_string()
        } else {
            DEFAULT_FASTER_WHISPER_MODEL.to_string()
        }
    } else {
        DEFAULT_FASTER_WHISPER_MODEL.to_string()
    };

    let normalized = candidate.to_ascii_lowercase().replace('_', "-");
    if matches!(
        normalized.as_str(),
        "nova"
            | "nova-2"
            | "nova-2-general"
            | "nova-2-meeting"
            | "nova-2-phonecall"
            | "nova-2-finance"
            | "nova-2-conversationalai"
            | "nova-2-voicemail"
            | "nova-3"
    ) {
        log::warn!(
            "Legacy STT model '{}' is incompatible with faster-whisper. Falling back to '{}'.",
            candidate,
            DEFAULT_FASTER_WHISPER_MODEL
        );
        return DEFAULT_FASTER_WHISPER_MODEL.to_string();
    }

    candidate
}

fn write_faster_whisper_stream_script() -> Result<std::path::PathBuf, String> {
    let path = std::env::temp_dir().join("kanpe_faster_whisper_stream.py");
    std::fs::write(&path, FASTER_WHISPER_STREAM_PY).map_err(|e| {
        format!(
            "failed to write faster-whisper helper script to {}: {}",
            path.display(),
            e
        )
    })?;
    Ok(path)
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

fn handle_faster_whisper_stdout_value(
    app: &AppHandle,
    session_id: &str,
    value: &serde_json::Value,
) -> Result<(), String> {
    let event_type = value
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or_default();

    if event_type != "transcript" {
        return Ok(());
    }

    let transcript = value
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();

    if transcript.is_empty() {
        return Ok(());
    }

    let status = match value.get("status").and_then(|v| v.as_str()) {
        Some("interim") => "interim",
        _ => "final",
    };

    let source = value
        .get("source")
        .and_then(|v| v.as_str())
        .unwrap_or(DEFAULT_STT_SOURCE);

    append_and_emit_caption(app, session_id, source, status, transcript)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppSettings;

    #[test]
    fn maps_legacy_deepgram_model_to_default_faster_whisper_model() {
        let mut settings = AppSettings::default();
        settings.stt_model = "nova-3".to_string();
        assert_eq!(effective_stt_model(&settings), DEFAULT_FASTER_WHISPER_MODEL);
    }

    #[test]
    fn keeps_supported_faster_whisper_model() {
        let mut settings = AppSettings::default();
        settings.stt_model = "large-v3".to_string();
        assert_eq!(effective_stt_model(&settings), "large-v3");
    }
}

pub fn emit_connection_status(app: &AppHandle, status: &str) {
    let _ = app.emit(
        "connection",
        serde_json::json!({
            "status": status
        }),
    );
}
