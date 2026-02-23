use crate::llm::{generate_reply, LlmRequest};
use crate::state::{AiLogEntry, AppState};
use chrono::Local;
use tauri::{AppHandle, Emitter, State};

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

    let (llm_language, conversation_context) = {
        let settings = state.settings.lock().map_err(|e| e.to_string())?.clone();
        let llm_language = if settings.llm_language.trim().is_empty() {
            "en".to_string()
        } else {
            settings.llm_language
        };

        let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        let context = sessions
            .iter()
            .find(|s| s.id == session_id)
            .map(build_context_from_session)
            .unwrap_or_else(|| "No conversation context available.".to_string());
        (llm_language, context)
    };

    let action_key = action
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(|v| v.to_lowercase());
    let (task_instruction, log_type) = action_instruction_and_log_type(action_key.as_deref());

    let system_prompt = format!(
        "You are Kanpe, a real-time meeting assistant. Always respond in language code '{}'. Keep answers concise and practical. If the request is unclear, ask one short clarifying question.",
        llm_language
    );

    let user_prompt = format!(
        "Task:\n{}\n\nUser query:\n{}\n\nRecent conversation context:\n{}\n",
        task_instruction, trimmed_query, conversation_context
    );

    let response = generate_reply(LlmRequest {
        system_prompt,
        user_prompt,
    })
    .await?;

    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
            session.ai_assists = session.ai_assists.saturating_add(1);
            session.ai_logs.push(AiLogEntry {
                time: Local::now().format("%H:%M:%S").to_string(),
                log_type: log_type.to_string(),
                text: response.clone(),
            });
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

fn action_instruction_and_log_type(action: Option<&str>) -> (&'static str, &'static str) {
    match action {
        Some("recap") => (
            "Summarize the conversation so far as a short recap. Focus on decisions, progress, blockers, and open points.",
            "recap",
        ),
        Some("assist") => (
            "Suggest what the speaker should say next in 1-3 concise bullet points.",
            "next-speak",
        ),
        Some("question") => (
            "Propose follow-up questions the speaker should ask next. Prioritize gaps and risks.",
            "questions",
        ),
        Some("action") => (
            "List concrete action items with owner (if inferable) and due timing (if inferable).",
            "followup",
        ),
        _ => (
            "Answer the query directly based on the conversation context. Keep it concise.",
            "freeform",
        ),
    }
}

fn build_context_from_session(session: &crate::state::SessionData) -> String {
    if session.captions.is_empty() {
        return "No captions available yet.".to_string();
    }

    let recent = session
        .captions
        .iter()
        .rev()
        .take(40)
        .collect::<Vec<_>>()
        .into_iter()
        .rev();

    let mut lines = String::new();
    for caption in recent {
        let line = format!(
            "[{}][{}][{}] {}\n",
            caption.time, caption.source, caption.status, caption.text
        );
        lines.push_str(&line);
    }

    if lines.chars().count() > 8_000 {
        lines.chars().take(8_000).collect::<String>()
    } else {
        lines
    }
}
