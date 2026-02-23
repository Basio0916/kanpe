use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn send_ai_query(
    _state: State<'_, AppState>,
    _session_id: String,
    query: String,
    action: Option<String>,
) -> Result<String, String> {
    // TODO: Implement actual LLM API call
    // For now, return a placeholder response
    let response = match action.as_deref() {
        Some("recap") => format!(
            "[Summary] Based on the current conversation context for query: {}",
            query
        ),
        Some("assist") => format!("[Suggestion] Based on the conversation flow: {}", query),
        Some("question") => format!("[Questions] Suggested questions based on: {}", query),
        Some("action") => format!("[Actions] Action items identified: {}", query),
        _ => format!("AI response to: {}", query),
    };

    Ok(response)
}
