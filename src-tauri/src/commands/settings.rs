use crate::state::{AppSettings, AppState};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppState>,
    settings: Value,
) -> Result<(), String> {
    let mut current = state.settings.lock().map_err(|e| e.to_string())?;

    if let Some(v) = settings.get("auto_start").and_then(|v| v.as_bool()) {
        current.auto_start = v;
    }
    if let Some(v) = settings.get("start_on_login").and_then(|v| v.as_bool()) {
        current.start_on_login = v;
    }
    if let Some(v) = settings.get("notifications").and_then(|v| v.as_bool()) {
        current.notifications = v;
    }
    if let Some(v) = settings.get("locale").and_then(|v| v.as_str()) {
        current.locale = v.to_string();
    }
    if let Some(v) = settings.get("stt_language").and_then(|v| v.as_str()) {
        current.stt_language = v.to_string();
    }
    if let Some(v) = settings.get("llm_language").and_then(|v| v.as_str()) {
        current.llm_language = v.to_string();
    }
    if let Some(v) = settings.get("mic_input").and_then(|v| v.as_str()) {
        current.mic_input = v.to_string();
    }
    if let Some(v) = settings.get("system_audio").and_then(|v| v.as_str()) {
        current.system_audio = v.to_string();
    }
    if let Some(v) = settings.get("noise_suppression").and_then(|v| v.as_bool()) {
        current.noise_suppression = v;
    }
    if let Some(v) = settings.get("stt_model").and_then(|v| v.as_str()) {
        current.stt_model = v.to_string();
    }
    if let Some(v) = settings.get("interim_results").and_then(|v| v.as_bool()) {
        current.interim_results = v;
    }
    if let Some(v) = settings.get("endpointing").and_then(|v| v.as_u64()) {
        current.endpointing = v as u32;
    }
    if let Some(v) = settings.get("auto_delete").and_then(|v| v.as_str()) {
        current.auto_delete = v.to_string();
    }

    Ok(())
}
