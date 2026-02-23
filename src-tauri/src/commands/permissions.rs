use crate::state::PermissionStatus;

#[tauri::command]
pub async fn check_permissions() -> Result<PermissionStatus, String> {
    // TODO: Implement actual macOS permission checks
    Ok(PermissionStatus {
        microphone: "unknown".to_string(),
        screen_audio: "unknown".to_string(),
        overlay: "granted".to_string(),
    })
}

#[tauri::command]
pub async fn request_permission(kind: String) -> Result<bool, String> {
    // TODO: Implement actual macOS permission requests
    log::info!("Requesting permission: {}", kind);
    Ok(true)
}

#[tauri::command]
pub async fn open_system_settings(panel: String) -> Result<(), String> {
    let url = match panel.as_str() {
        "microphone" => "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
        "screen_audio" => "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
        _ => "x-apple.systempreferences:com.apple.preference.security",
    };

    std::process::Command::new("open")
        .arg(url)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}
