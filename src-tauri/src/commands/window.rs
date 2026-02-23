use tauri::AppHandle;

#[tauri::command]
pub async fn show_overlay(app: AppHandle) -> Result<(), String> {
    crate::window::show_overlay_window(&app)
}

#[tauri::command]
pub async fn hide_overlay(app: AppHandle) -> Result<(), String> {
    crate::window::hide_overlay_window(&app)
}
