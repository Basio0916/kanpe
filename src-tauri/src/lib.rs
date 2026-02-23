pub mod audio;
pub mod commands;
pub mod llm;
pub mod state;
pub mod window;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = dotenvy::dotenv();
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::recording::start_recording,
            commands::recording::stop_recording,
            commands::recording::pause_recording,
            commands::recording::resume_recording,
            commands::recording::get_active_session_id,
            commands::sessions::get_sessions,
            commands::sessions::get_session,
            commands::sessions::delete_session,
            commands::sessions::export_session,
            commands::ai::send_ai_query,
            commands::permissions::check_permissions,
            commands::permissions::request_permission,
            commands::permissions::open_system_settings,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::window::show_overlay,
            commands::window::hide_overlay,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
