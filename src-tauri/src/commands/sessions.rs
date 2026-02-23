use crate::state::{save_sessions_to_disk, AppState};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn get_sessions(state: State<'_, AppState>) -> Result<Value, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let list: Vec<Value> = sessions
        .iter()
        .map(|s| {
            serde_json::json!({
                "id": s.id,
                "title": s.title,
                "duration": s.duration,
                "time": s.time,
                "created_at": s.created_at,
                "is_active": s.is_active,
            })
        })
        .collect();
    Ok(serde_json::json!(list))
}

#[tauri::command]
pub async fn get_session(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| "Session not found".to_string())?;

    Ok(serde_json::json!({
        "id": session.id,
        "title": session.title,
        "duration": session.duration,
        "time": session.time,
        "created_at": session.created_at,
        "is_active": session.is_active,
        "captions": session.captions,
        "ai_logs": session.ai_logs,
        "summary": session.summary,
        "participants": session.participants,
        "ai_assists": session.ai_assists,
        "stt_processing_time": session.duration,
        "ai_inference_count": session.ai_assists,
        "audio_data_size": "0 MB",
        "token_usage": 0,
    }))
}

#[tauri::command]
pub async fn delete_session(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.retain(|s| s.id != id);
    save_sessions_to_disk(&sessions)?;
    Ok(())
}

#[tauri::command]
pub async fn export_session(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .iter()
        .find(|s| s.id == id)
        .ok_or_else(|| "Session not found".to_string())?;

    serde_json::to_string_pretty(session).map_err(|e| e.to_string())
}
