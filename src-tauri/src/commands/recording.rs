use crate::state::{AppState, CaptionEntry, SessionData};
use chrono::Local;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

#[tauri::command]
pub async fn start_recording(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    let now = Local::now();

    let session = SessionData {
        id: session_id.clone(),
        title: "Untitled session".to_string(),
        duration: "0:00".to_string(),
        time: now.format("%I:%M%P").to_string(),
        created_at: now.to_rfc3339(),
        is_active: true,
        captions: Vec::new(),
        ai_logs: Vec::new(),
        summary: String::new(),
        participants: 0,
        ai_assists: 0,
    };

    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        sessions.push(session);
    }
    {
        let mut active = state
            .active_session_id
            .lock()
            .map_err(|e| e.to_string())?;
        *active = Some(session_id.clone());
    }

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
    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
            session.is_active = false;
        }
    }
    {
        let mut active = state
            .active_session_id
            .lock()
            .map_err(|e| e.to_string())?;
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

    // Hide overlay when recording stops
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }

    Ok(())
}

#[tauri::command]
pub async fn pause_recording(
    app: AppHandle,
    _state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    app.emit(
        "recording-state",
        serde_json::json!({
            "state": "paused",
            "sessionId": session_id
        }),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn resume_recording(
    app: AppHandle,
    _state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
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

// Helper to emit caption events (called from audio pipeline)
pub fn emit_caption(app: &AppHandle, entry: &CaptionEntry) -> Result<(), String> {
    app.emit("caption", entry).map_err(|e| e.to_string())
}
