use crate::audio::{emit_connection_status, start_live_caption_runtime, RecordingRuntime};
use crate::llm::{generate_reply, LlmRequest};
use crate::state::{save_sessions_to_disk, AppState, CaptionEntry, SessionData};
use chrono::{DateTime, Local};
use serde::Deserialize;
use std::collections::HashSet;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

const UNTITLED_SESSION: &str = "Untitled session";
const MAX_TITLE_CHARS: usize = 42;
const MAX_SUMMARY_CONTEXT_CHARS: usize = 48_000;
const MAX_FALLBACK_SUMMARY_CHARS: usize = 6_000;
const SUMMARY_MAX_OUTPUT_TOKENS: u32 = 2_400;

struct SessionFinalizeContext {
    created_at: String,
    captions: Vec<CaptionEntry>,
    llm_language: String,
}

struct SessionFinalizeMetadata {
    title: String,
    summary: String,
    duration: String,
    participants: u32,
}

#[derive(Debug, Deserialize)]
struct LlmSessionMetadata {
    title: String,
    summary: String,
}

fn stop_runtime_instance(runtime: RecordingRuntime) {
    let _ = runtime.stop_tx.send(());
    for handle in runtime.tasks {
        handle.abort();
    }
}

fn stop_recording_runtime(state: &AppState) -> Result<(), String> {
    let runtime = {
        let mut guard = state.recording_runtime.lock().map_err(|e| e.to_string())?;
        guard.take()
    };
    if let Some(runtime) = runtime {
        stop_runtime_instance(runtime);
    }
    Ok(())
}

fn replace_recording_runtime(state: &AppState, runtime: RecordingRuntime) -> Result<(), String> {
    let previous = {
        let mut guard = state.recording_runtime.lock().map_err(|e| e.to_string())?;
        guard.replace(runtime)
    };
    if let Some(previous) = previous {
        stop_runtime_instance(previous);
    }
    Ok(())
}

fn format_duration(total_seconds: i64) -> String {
    let normalized = total_seconds.max(0);
    let hours = normalized / 3_600;
    let minutes = (normalized % 3_600) / 60;
    let seconds = normalized % 60;
    if hours > 0 {
        format!("{}:{:02}:{:02}", hours, minutes, seconds)
    } else {
        format!("{}:{:02}", minutes, seconds)
    }
}

fn compute_duration_from_created_at(created_at: &str) -> String {
    let now = Local::now();
    let Some(start) = DateTime::parse_from_rfc3339(created_at)
        .ok()
        .map(|dt| dt.with_timezone(&Local))
    else {
        return "0:00".to_string();
    };
    format_duration((now - start).num_seconds())
}

fn estimate_participants(captions: &[CaptionEntry]) -> u32 {
    let mut sources = HashSet::<String>::new();
    for caption in captions {
        let source = caption.source.trim();
        if !source.is_empty() {
            sources.insert(source.to_string());
        }
    }
    sources.len() as u32
}

fn build_transcript_for_summary(captions: &[CaptionEntry]) -> String {
    let final_captions = captions
        .iter()
        .filter(|c| c.status == "final")
        .collect::<Vec<_>>();
    let source = if final_captions.is_empty() {
        captions.iter().collect::<Vec<_>>()
    } else {
        final_captions
    };
    if source.is_empty() {
        return String::new();
    }

    let lines = source
        .iter()
        .map(|caption| {
            format!(
                "[{}][{}] {}",
                caption.time,
                caption.source,
                caption.text.trim()
            )
        })
        .collect::<Vec<_>>();

    let composed = if lines.len() <= 220 {
        lines.join("\n")
    } else {
        let timeline = sample_evenly_strings(&lines, 180).join("\n");
        let recent = lines
            .iter()
            .rev()
            .take(120)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        format!(
            "Whole timeline sample (chronological):\n{}\n\nRecent segment (verbatim, high priority):\n{}",
            timeline, recent
        )
    };

    clamp_context_preserving_tail(&composed, MAX_SUMMARY_CONTEXT_CHARS)
}

fn sample_evenly_strings(lines: &[String], target: usize) -> Vec<String> {
    if lines.is_empty() || target == 0 {
        return Vec::new();
    }
    if lines.len() <= target {
        return lines.to_vec();
    }

    let mut sampled: Vec<String> = Vec::with_capacity(target);
    for i in 0..target {
        let idx = i * lines.len() / target;
        if let Some(line) = lines.get(idx) {
            sampled.push(line.clone());
        }
    }
    sampled
}

fn clamp_context_preserving_tail(value: &str, max_chars: usize) -> String {
    let total = value.chars().count();
    if total <= max_chars {
        return value.to_string();
    }

    let head_len = (max_chars * 2) / 5;
    let tail_len = max_chars.saturating_sub(head_len + 32);
    let head = value.chars().take(head_len).collect::<String>();
    let tail = value
        .chars()
        .rev()
        .take(tail_len)
        .collect::<String>()
        .chars()
        .rev()
        .collect::<String>();

    format!("{}\n\n[... omitted for length ...]\n\n{}", head, tail)
}

fn normalize_line_text(input: &str) -> String {
    input.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn clamp_with_ellipsis(value: &str, max_chars: usize) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    let head: String = trimmed.chars().take(max_chars.saturating_sub(1)).collect();
    format!("{}…", head.trim_end())
}

fn fallback_title(captions: &[CaptionEntry], llm_language: &str) -> String {
    let seed = captions
        .iter()
        .find_map(|c| {
            let t = c.text.trim();
            if t.is_empty() {
                None
            } else {
                Some(t)
            }
        })
        .unwrap_or(UNTITLED_SESSION);

    let default_title = if llm_language.starts_with("ja") {
        "会議メモ"
    } else {
        UNTITLED_SESSION
    };

    let normalized = normalize_line_text(seed);
    if normalized.is_empty() {
        default_title.to_string()
    } else {
        clamp_with_ellipsis(&normalized, MAX_TITLE_CHARS)
    }
}

fn fallback_summary(captions: &[CaptionEntry], llm_language: &str) -> String {
    let merged = captions
        .iter()
        .filter_map(|c| {
            let t = c.text.trim();
            if t.is_empty() {
                None
            } else {
                Some(t)
            }
        })
        .collect::<Vec<_>>()
        .join(" ");

    if merged.trim().is_empty() {
        return if llm_language.starts_with("ja") {
            "要約を生成できませんでした。"
        } else {
            "Summary could not be generated."
        }
        .to_string();
    }
    clamp_with_ellipsis(&normalize_line_text(&merged), MAX_FALLBACK_SUMMARY_CHARS)
}

fn parse_llm_metadata(raw: &str) -> Option<LlmSessionMetadata> {
    if let Ok(parsed) = serde_json::from_str::<LlmSessionMetadata>(raw) {
        return Some(parsed);
    }

    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    if end <= start {
        return None;
    }

    serde_json::from_str::<LlmSessionMetadata>(&raw[start..=end]).ok()
}

async fn generate_title_and_summary(
    captions: &[CaptionEntry],
    llm_language: &str,
) -> Result<(String, String), String> {
    let transcript = build_transcript_for_summary(captions);
    if transcript.trim().is_empty() {
        return Err("要約用の発話テキストがありません".to_string());
    }

    let system_prompt = format!(
        "You are a meeting assistant. Respond only with strict JSON. Output language must follow '{}'. JSON schema: {{\"title\":\"...\",\"summary\":\"...\"}}. Title should be short (max 42 chars). Summary must comprehensively cover the full meeting timeline from beginning to end, including later-half developments, key decisions, unresolved issues, and next steps. Do not use Markdown in the summary text.",
        llm_language
    );
    let user_prompt = format!(
        "Create a session title and summary from this transcript. Ensure the summary reflects the entire timeline and does not miss the latter half:\n\n{}",
        transcript
    );
    let response = generate_reply(LlmRequest {
        system_prompt,
        user_prompt,
        max_output_tokens: Some(SUMMARY_MAX_OUTPUT_TOKENS),
    })
    .await?;
    let parsed = parse_llm_metadata(&response)
        .ok_or_else(|| "LLM応答を title/summary JSON として解釈できませんでした".to_string())?;

    let title = clamp_with_ellipsis(&normalize_line_text(&parsed.title), MAX_TITLE_CHARS);
    let summary = normalize_line_text(&parsed.summary);

    if title.is_empty() || summary.is_empty() {
        return Err("LLM応答の title または summary が空です".to_string());
    }

    Ok((title, summary))
}

async fn build_session_finalize_metadata(
    context: SessionFinalizeContext,
) -> SessionFinalizeMetadata {
    let duration = compute_duration_from_created_at(&context.created_at);
    let participants = estimate_participants(&context.captions);
    let fallback_title = fallback_title(&context.captions, &context.llm_language);
    let fallback_summary = fallback_summary(&context.captions, &context.llm_language);

    let (title, summary) =
        match generate_title_and_summary(&context.captions, &context.llm_language).await {
            Ok(generated) => generated,
            Err(err) => {
                log::warn!("Failed to auto-generate session metadata: {}", err);
                (fallback_title, fallback_summary)
            }
        };

    SessionFinalizeMetadata {
        title,
        summary,
        duration,
        participants,
    }
}

#[tauri::command]
pub async fn start_recording(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    stop_recording_runtime(&state)?;
    let previous_active = {
        let mut active = state.active_session_id.lock().map_err(|e| e.to_string())?;
        active.take()
    };
    if let Some(previous_session_id) = previous_active {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.iter_mut().find(|s| s.id == previous_session_id) {
            session.is_active = false;
        }
    }

    let session_id = Uuid::new_v4().to_string();
    let now = Local::now();

    let session = SessionData {
        id: session_id.clone(),
        title: UNTITLED_SESSION.to_string(),
        duration: "0:00".to_string(),
        time: now.format("%I:%M%P").to_string(),
        created_at: now.to_rfc3339(),
        is_active: true,
        captions: Vec::new(),
        ai_logs: Vec::new(),
        summary: String::new(),
        participants: 0,
        ai_assists: 0,
        self_speaker_tags: Vec::new(),
    };

    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        sessions.push(session);
        save_sessions_to_disk(&sessions)?;
    }
    {
        let mut active = state.active_session_id.lock().map_err(|e| e.to_string())?;
        *active = Some(session_id.clone());
    }

    let runtime = match start_live_caption_runtime(app.clone(), session_id.clone()) {
        Ok(runtime) => runtime,
        Err(err) => {
            {
                let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
                sessions.retain(|s| s.id != session_id);
                save_sessions_to_disk(&sessions)?;
            }
            {
                let mut active = state.active_session_id.lock().map_err(|e| e.to_string())?;
                *active = None;
            }
            emit_connection_status(&app, "disconnected");
            return Err(err);
        }
    };
    replace_recording_runtime(&state, runtime)?;

    app.emit(
        "recording-state",
        serde_json::json!({
            "state": "recording",
            "sessionId": session_id
        }),
    )
    .map_err(|e| e.to_string())?;

    Ok(session_id)
}

#[tauri::command]
pub async fn stop_recording(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    stop_recording_runtime(&state)?;

    let llm_language = state
        .settings
        .lock()
        .map_err(|e| e.to_string())?
        .llm_language
        .clone();
    let context = {
        let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        let session = sessions
            .iter()
            .find(|s| s.id == session_id)
            .ok_or_else(|| "Session not found".to_string())?;
        SessionFinalizeContext {
            created_at: session.created_at.clone(),
            captions: session.captions.clone(),
            llm_language,
        }
    };

    let finalized = build_session_finalize_metadata(context).await;

    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
            session.is_active = false;
            session.title = finalized.title.clone();
            session.summary = finalized.summary.clone();
            session.duration = finalized.duration.clone();
            session.participants = finalized.participants;
            session.time = Local::now().format("%I:%M%P").to_string();
        }
        save_sessions_to_disk(&sessions)?;
    }
    {
        let mut active = state.active_session_id.lock().map_err(|e| e.to_string())?;
        *active = None;
    }

    app.emit(
        "recording-state",
        serde_json::json!({
            "state": "stopped",
            "sessionId": session_id
        }),
    )
    .map_err(|e| e.to_string())?;
    app.emit(
        "session-completed",
        serde_json::json!({
            "sessionId": session_id,
            "title": finalized.title,
            "summary": finalized.summary
        }),
    )
    .map_err(|e| e.to_string())?;
    emit_connection_status(&app, "disconnected");

    // Hide overlay when recording stops
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }

    Ok(())
}

#[tauri::command]
pub async fn pause_recording(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    stop_recording_runtime(&state)?;

    app.emit(
        "recording-state",
        serde_json::json!({
            "state": "paused",
            "sessionId": session_id
        }),
    )
    .map_err(|e| e.to_string())?;
    emit_connection_status(&app, "disconnected");

    Ok(())
}

#[tauri::command]
pub async fn resume_recording(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let runtime = start_live_caption_runtime(app.clone(), session_id.clone())?;
    replace_recording_runtime(&state, runtime)?;

    app.emit(
        "recording-state",
        serde_json::json!({
            "state": "recording",
            "sessionId": session_id
        }),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_active_session_id(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let active = state.active_session_id.lock().map_err(|e| e.to_string())?;
    Ok(active.clone())
}
