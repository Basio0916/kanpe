use crate::audio::{emit_connection_status, start_live_caption_runtime, RecordingRuntime};
use crate::state::{AppState, SessionData};
use chrono::Local;
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

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
        let mut active = state.active_session_id.lock().map_err(|e| e.to_string())?;
        *active = Some(session_id.clone());
    }

    let runtime = match start_live_caption_runtime(app.clone(), session_id.clone()) {
        Ok(runtime) => runtime,
        Err(err) => {
            {
                let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
                sessions.retain(|s| s.id != session_id);
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

    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
            session.is_active = false;
        }
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
