use crate::audio::RecordingRuntime;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionData {
    pub id: String,
    pub title: String,
    pub duration: String,
    pub time: String,
    pub created_at: String,
    pub is_active: bool,
    pub captions: Vec<CaptionEntry>,
    pub ai_logs: Vec<AiLogEntry>,
    pub summary: String,
    pub participants: u32,
    pub ai_assists: u32,
    #[serde(default)]
    pub self_speaker_tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CaptionEntry {
    pub time: String,
    pub source: String,
    pub status: String,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiLogEntry {
    pub time: String,
    #[serde(rename = "type")]
    pub log_type: String,
    #[serde(default = "default_ai_log_role")]
    pub role: String,
    pub text: String,
}

fn default_ai_log_role() -> String {
    "assistant".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct AppSettings {
    pub auto_start: bool,
    pub start_on_login: bool,
    pub notifications: bool,
    pub locale: String,
    pub stt_language: String,
    pub llm_language: String,
    pub mic_input: String,
    pub system_audio: String,
    pub noise_suppression: bool,
    pub stt_model: String,
    pub interim_results: bool,
    pub endpointing: u32,
    pub auto_delete: String,
    pub self_speaker_tag: String,
    pub self_speaker_tags: Vec<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_start: false,
            start_on_login: true,
            notifications: true,
            locale: "en".to_string(),
            stt_language: "en".to_string(),
            llm_language: "en".to_string(),
            mic_input: "default".to_string(),
            system_audio: "screen_capture".to_string(),
            noise_suppression: true,
            stt_model: "nova-3".to_string(),
            interim_results: true,
            endpointing: 300,
            auto_delete: "30days".to_string(),
            self_speaker_tag: "".to_string(),
            self_speaker_tags: Vec::new(),
        }
    }
}

impl AppSettings {
    pub(crate) fn settings_dir() -> Result<PathBuf, String> {
        let base = dirs::config_dir()
            .ok_or_else(|| "設定ディレクトリを取得できませんでした".to_string())?;
        Ok(base.join("kanpe"))
    }

    fn settings_path() -> Result<PathBuf, String> {
        Ok(Self::settings_dir()?.join("settings.json"))
    }

    pub fn load_from_disk() -> Result<Option<Self>, String> {
        let path = Self::settings_path()?;
        if !path.exists() {
            return Ok(None);
        }

        let raw = std::fs::read_to_string(&path).map_err(|e| {
            format!(
                "設定ファイルの読み込みに失敗しました ({}): {}",
                path.display(),
                e
            )
        })?;
        let parsed = serde_json::from_str::<Self>(&raw).map_err(|e| {
            format!(
                "設定ファイルの解析に失敗しました ({}): {}",
                path.display(),
                e
            )
        })?;
        Ok(Some(parsed))
    }

    pub fn save_to_disk(&self) -> Result<(), String> {
        let dir = Self::settings_dir()?;
        std::fs::create_dir_all(&dir).map_err(|e| {
            format!(
                "設定ディレクトリの作成に失敗しました ({}): {}",
                dir.display(),
                e
            )
        })?;

        let path = dir.join("settings.json");
        let raw = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(&path, raw).map_err(|e| {
            format!(
                "設定ファイルの保存に失敗しました ({}): {}",
                path.display(),
                e
            )
        })
    }
}

fn sessions_path() -> Result<PathBuf, String> {
    Ok(AppSettings::settings_dir()?.join("sessions.json"))
}

pub fn load_sessions_from_disk() -> Result<Option<Vec<SessionData>>, String> {
    let path = sessions_path()?;
    if !path.exists() {
        return Ok(None);
    }

    let raw = std::fs::read_to_string(&path).map_err(|e| {
        format!(
            "セッションファイルの読み込みに失敗しました ({}): {}",
            path.display(),
            e
        )
    })?;
    let parsed = serde_json::from_str::<Vec<SessionData>>(&raw).map_err(|e| {
        format!(
            "セッションファイルの解析に失敗しました ({}): {}",
            path.display(),
            e
        )
    })?;
    Ok(Some(parsed))
}

pub fn save_sessions_to_disk(sessions: &[SessionData]) -> Result<(), String> {
    let dir = AppSettings::settings_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| {
        format!(
            "設定ディレクトリの作成に失敗しました ({}): {}",
            dir.display(),
            e
        )
    })?;

    let path = dir.join("sessions.json");
    let raw = serde_json::to_string_pretty(sessions).map_err(|e| e.to_string())?;
    std::fs::write(&path, raw).map_err(|e| {
        format!(
            "セッションファイルの保存に失敗しました ({}): {}",
            path.display(),
            e
        )
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PermissionStatus {
    pub microphone: String,
    pub screen_audio: String,
    pub overlay: String,
}

pub struct AppState {
    pub sessions: Mutex<Vec<SessionData>>,
    pub settings: Mutex<AppSettings>,
    pub active_session_id: Mutex<Option<String>>,
    pub recording_runtime: Mutex<Option<RecordingRuntime>>,
}

impl AppState {
    pub fn new() -> Self {
        let settings = match AppSettings::load_from_disk() {
            Ok(Some(saved)) => saved,
            Ok(None) => AppSettings::default(),
            Err(err) => {
                log::warn!(
                    "Failed to load app settings. Falling back to defaults: {}",
                    err
                );
                AppSettings::default()
            }
        };
        let mut sessions = match load_sessions_from_disk() {
            Ok(Some(saved)) => saved,
            Ok(None) => Vec::new(),
            Err(err) => {
                log::warn!(
                    "Failed to load session history. Starting with empty list: {}",
                    err
                );
                Vec::new()
            }
        };
        for session in &mut sessions {
            session.is_active = false;
        }

        Self {
            sessions: Mutex::new(sessions),
            settings: Mutex::new(settings),
            active_session_id: Mutex::new(None),
            recording_runtime: Mutex::new(None),
        }
    }
}
