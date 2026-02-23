use crate::llm::{generate_reply, LlmRequest};
use crate::state::{save_sessions_to_disk, AiLogEntry, AppState, CaptionEntry};
use chrono::Local;
use tauri::{AppHandle, Emitter, State};

const MAX_CONTEXT_CHARS: usize = 8_000;
const MAX_RECAP_CHARS: usize = 900;

#[derive(Clone, Copy)]
enum ActionKind {
    Recap,
    Assist,
    Question,
    Action,
    Freeform,
}

struct ActionConfig {
    kind: ActionKind,
    task_instruction: &'static str,
    log_type: &'static str,
}

#[tauri::command]
pub async fn send_ai_query(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    query: String,
    action: Option<String>,
) -> Result<String, String> {
    let trimmed_query = query.trim();
    if trimmed_query.is_empty() {
        return Err("クエリが空です".to_string());
    }

    let action_key = action
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(|v| v.to_lowercase());
    let action_config = action_config(action_key.as_deref());

    let (llm_language, conversation_context) = {
        let settings = state.settings.lock().map_err(|e| e.to_string())?.clone();
        let llm_language = if settings.llm_language.trim().is_empty() {
            "en".to_string()
        } else {
            settings.llm_language.clone()
        };
        let self_speaker_tags = collect_self_speaker_tags(&settings);

        let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        let context = sessions
            .iter()
            .find(|s| s.id == session_id)
            .map(|s| build_context_from_session(s, action_config.kind, &self_speaker_tags))
            .unwrap_or_else(|| "No conversation context available.".to_string());
        (llm_language, context)
    };

    let system_prompt = format!(
        "You are Kanpe, a real-time meeting assistant. Always respond in language code '{}'. Keep answers concise and practical. Output plain text only. Do not use Markdown, headings, bullet markers, or code fences. If the request is unclear, ask one short clarifying question. In context lines, role:SELF means the current user, role:OTHER means other speakers.",
        llm_language
    );

    let user_prompt = format!(
        "Task:\n{}\n\nUser query:\n{}\n\nConversation context:\n{}\n",
        action_config.task_instruction, trimmed_query, conversation_context
    );

    let raw_response = generate_reply(LlmRequest {
        system_prompt,
        user_prompt,
        max_output_tokens: None,
    })
    .await?;
    let response = normalize_ai_output(action_config.kind, &raw_response, &llm_language);

    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
            session.ai_assists = session.ai_assists.saturating_add(1);
            session.ai_logs.push(AiLogEntry {
                time: Local::now().format("%H:%M:%S").to_string(),
                log_type: action_config.log_type.to_string(),
                text: response.clone(),
            });
            save_sessions_to_disk(&sessions)?;
        }
    }

    app.emit(
        "ai-response",
        serde_json::json!({
            "sessionId": session_id,
            "content": response.clone()
        }),
    )
    .map_err(|e| e.to_string())?;

    Ok(response)
}

fn action_config(action: Option<&str>) -> ActionConfig {
    match action {
        Some("recap") => ActionConfig {
            kind: ActionKind::Recap,
            task_instruction: "Generate a concise recap in natural prose (summary style, plain text only).
Focus rule: keep the whole conversation context, but weight recent discussion more heavily.
Output format:
Paragraph 1: overall topic and flow in 2-3 sentences.
Paragraph 2: recent focus, decisions, open issues, and next steps in 2-4 sentences.
Do not output markdown, headings, bullet symbols, or disclaimer notes.",
            log_type: "recap",
        },
        Some("assist") => ActionConfig {
            kind: ActionKind::Assist,
            task_instruction: "Suggest what the speaker should say next in 1-3 concise lines.
Prioritize very recent turns strongly. Use older turns only as background context.",
            log_type: "next-speak",
        },
        Some("question") => ActionConfig {
            kind: ActionKind::Question,
            task_instruction: "Propose 3-6 follow-up questions that naturally fit the current conversation.
Mix question types across: clarification, deeper understanding, decision making, alignment check, and next-step planning.
Do not focus only on risks unless the recent context clearly demands it.
Prioritize very recent turns strongly, while keeping whole-context consistency.
Output plain text with one question per line.",
            log_type: "questions",
        },
        Some("action") => ActionConfig {
            kind: ActionKind::Action,
            task_instruction: "List concrete action items with owner (if inferable) and due timing (if inferable).
Capture action items from the whole conversation timeline (early, middle, recent), not only recent turns.",
            log_type: "followup",
        },
        _ => ActionConfig {
            kind: ActionKind::Freeform,
            task_instruction:
                "Answer the query directly based on the conversation context. Keep it concise.",
            log_type: "freeform",
        },
    }
}

fn normalize_ai_output(action_kind: ActionKind, raw: &str, llm_language: &str) -> String {
    let cleaned = sanitize_plain_text(raw);
    match action_kind {
        ActionKind::Recap => normalize_recap_output(&cleaned, llm_language),
        _ => {
            if cleaned.trim().is_empty() {
                if llm_language.starts_with("ja") {
                    "回答を生成できませんでした。".to_string()
                } else {
                    "Could not generate a response.".to_string()
                }
            } else {
                cleaned
            }
        }
    }
}

fn sanitize_plain_text(raw: &str) -> String {
    let mut out: Vec<String> = Vec::new();
    let mut in_code_block = false;

    for line in raw.lines() {
        let mut current = line.trim().to_string();
        if current.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }

        while current.starts_with('#') {
            current = current[1..].trim_start().to_string();
        }

        if current == "---" || current == "***" || current == "___" {
            continue;
        }

        for prefix in ["- ", "* ", "• ", "> "] {
            if current.starts_with(prefix) {
                current = current[prefix.len()..].trim_start().to_string();
            }
        }

        current = strip_numeric_list_prefix(&current);
        current = current.replace("**", "").replace("__", "").replace('`', "");
        let normalized = current.split_whitespace().collect::<Vec<_>>().join(" ");
        if !normalized.is_empty() {
            out.push(normalized);
        }
    }

    out.join("\n")
}

fn strip_numeric_list_prefix(line: &str) -> String {
    let bytes = line.as_bytes();
    let mut idx = 0usize;
    while idx < bytes.len() && bytes[idx].is_ascii_digit() {
        idx += 1;
    }

    if idx > 0 && idx + 1 < bytes.len() && (bytes[idx] == b'.' || bytes[idx] == b')') {
        let mut next = idx + 1;
        while next < bytes.len() && bytes[next].is_ascii_whitespace() {
            next += 1;
        }
        return line[next..].to_string();
    }

    line.to_string()
}

fn normalize_recap_output(cleaned: &str, llm_language: &str) -> String {
    let lines = cleaned
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter(|line| !is_recap_noise_line(line))
        .collect::<Vec<_>>();

    if lines.is_empty() {
        return if llm_language.starts_with("ja") {
            "要約を生成できませんでした。".to_string()
        } else {
            "Could not generate a recap.".to_string()
        };
    }

    let merged = lines.join(" ");
    clamp_text(&merged, MAX_RECAP_CHARS)
}

fn is_recap_noise_line(line: &str) -> bool {
    let lower = line.to_lowercase();
    lower.contains("音声認識")
        || lower.contains("不正確")
        || lower.contains("内容確認")
        || lower.contains("may be inaccurate")
        || lower.contains("transcription may")
        || lower.contains("please verify")
}

fn clamp_text(value: &str, max_chars: usize) -> String {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.chars().count() <= max_chars {
        return normalized;
    }

    let head = normalized
        .chars()
        .take(max_chars.saturating_sub(1))
        .collect::<String>();
    format!("{}…", head.trim_end())
}

fn build_context_from_session(
    session: &crate::state::SessionData,
    action_kind: ActionKind,
    self_speaker_tags: &[String],
) -> String {
    match action_kind {
        ActionKind::Recap | ActionKind::Assist | ActionKind::Question => {
            build_recent_priority_context(session, self_speaker_tags)
        }
        ActionKind::Action => build_action_global_context(session, self_speaker_tags),
        ActionKind::Freeform => build_recent_context(session, 40, self_speaker_tags),
    }
}

fn build_recent_context(
    session: &crate::state::SessionData,
    take: usize,
    self_speaker_tags: &[String],
) -> String {
    let captions = select_context_captions(session);
    if captions.is_empty() {
        return "No captions available yet.".to_string();
    }

    let recent = captions
        .into_iter()
        .rev()
        .take(take)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .map(|c| format_caption_line(c, self_speaker_tags))
        .collect::<Vec<_>>()
        .join("\n");
    clamp_text(&recent, MAX_CONTEXT_CHARS)
}

fn build_recent_priority_context(
    session: &crate::state::SessionData,
    self_speaker_tags: &[String],
) -> String {
    let captions = select_context_captions(session);
    if captions.is_empty() {
        return "No captions available yet.".to_string();
    }

    let global_sample = sample_evenly(&captions, captions.len().min(16))
        .into_iter()
        .map(|c| format_caption_line(c, self_speaker_tags))
        .collect::<Vec<_>>()
        .join("\n");

    let recent_count = captions.len().min(42);
    let recent_slice = &captions[captions.len() - recent_count..];
    let recent_sample = recent_slice
        .iter()
        .copied()
        .map(|c| format_caption_line(c, self_speaker_tags))
        .collect::<Vec<_>>()
        .join("\n");

    let combined = format!(
        "Long-range context (low weight):\n{}\n\nRecent context (high weight, prioritize this when summarizing):\n{}",
        global_sample, recent_sample
    );

    clamp_text(&combined, MAX_CONTEXT_CHARS)
}

fn build_action_global_context(
    session: &crate::state::SessionData,
    self_speaker_tags: &[String],
) -> String {
    let captions = select_context_captions(session);
    if captions.is_empty() {
        return "No captions available yet.".to_string();
    }

    let full_timeline_sample = sample_evenly(&captions, captions.len().min(72))
        .into_iter()
        .map(|c| format_caption_line(c, self_speaker_tags))
        .collect::<Vec<_>>()
        .join("\n");

    let recent_count = captions.len().min(24);
    let recent_slice = &captions[captions.len() - recent_count..];
    let recent_sample = recent_slice
        .iter()
        .copied()
        .map(|c| format_caption_line(c, self_speaker_tags))
        .collect::<Vec<_>>()
        .join("\n");

    let combined = format!(
        "Whole-timeline context (high weight, primary for action extraction):\n{}\n\nRecent context (secondary reference):\n{}",
        full_timeline_sample, recent_sample
    );

    clamp_text(&combined, MAX_CONTEXT_CHARS)
}

fn select_context_captions(session: &crate::state::SessionData) -> Vec<&CaptionEntry> {
    let finals = session
        .captions
        .iter()
        .filter(|c| c.status == "final")
        .collect::<Vec<_>>();
    if finals.is_empty() {
        session.captions.iter().collect::<Vec<_>>()
    } else {
        finals
    }
}

fn sample_evenly<'a>(captions: &[&'a CaptionEntry], target: usize) -> Vec<&'a CaptionEntry> {
    if captions.is_empty() || target == 0 {
        return Vec::new();
    }
    if captions.len() <= target {
        return captions.to_vec();
    }

    let mut sampled: Vec<&CaptionEntry> = Vec::new();
    for i in 0..target {
        let idx = i * captions.len() / target;
        if let Some(&item) = captions.get(idx) {
            sampled.push(item);
        }
    }
    sampled
}

fn normalize_speaker_tag(tag: &str) -> String {
    tag.trim().to_uppercase()
}

fn collect_self_speaker_tags(settings: &crate::state::AppSettings) -> Vec<String> {
    let mut tags: Vec<String> = Vec::new();

    if !settings.self_speaker_tag.trim().is_empty() {
        tags.push(normalize_speaker_tag(&settings.self_speaker_tag));
    }

    for tag in &settings.self_speaker_tags {
        let normalized = normalize_speaker_tag(tag);
        if normalized.is_empty() || tags.contains(&normalized) {
            continue;
        }
        tags.push(normalized);
    }

    tags
}

fn speaker_role_label(source: &str, self_speaker_tags: &[String]) -> &'static str {
    let normalized_source = normalize_speaker_tag(source);
    if self_speaker_tags
        .iter()
        .any(|tag| !tag.is_empty() && *tag == normalized_source)
    {
        "SELF"
    } else {
        "OTHER"
    }
}

fn format_caption_line(caption: &CaptionEntry, self_speaker_tags: &[String]) -> String {
    let role = speaker_role_label(&caption.source, self_speaker_tags);
    format!(
        "[{}][source:{}][role:{}][status:{}] {}",
        caption.time, caption.source, role, caption.status, caption.text
    )
}
