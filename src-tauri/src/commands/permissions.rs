use crate::state::PermissionStatus;

// ── macOS permission APIs ──

#[cfg(target_os = "macos")]
mod macos {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        pub fn CGPreflightScreenCaptureAccess() -> bool;
        pub fn CGRequestScreenCaptureAccess() -> bool;
    }

    #[link(name = "AVFoundation", kind = "framework")]
    extern "C" {}

    /// Check microphone authorization status via AVCaptureDevice
    pub fn check_microphone() -> &'static str {
        use objc::runtime::Class;
        use objc::{msg_send, sel, sel_impl};

        unsafe {
            let cls = match Class::get("AVCaptureDevice") {
                Some(c) => c,
                None => return "unknown",
            };
            let ns_string = match Class::get("NSString") {
                Some(c) => c,
                None => return "unknown",
            };

            // AVMediaTypeAudio = "soun"
            let audio_type: *mut objc::runtime::Object =
                msg_send![ns_string, stringWithUTF8String: b"soun\0".as_ptr()];

            let status: i64 = msg_send![cls, authorizationStatusForMediaType: audio_type];

            match status {
                0 => "unknown", // AVAuthorizationStatusNotDetermined
                1 => "denied",  // AVAuthorizationStatusRestricted
                2 => "denied",  // AVAuthorizationStatusDenied
                3 => "granted", // AVAuthorizationStatusAuthorized
                _ => "unknown",
            }
        }
    }

    /// Check screen capture permission via CoreGraphics
    pub fn check_screen_capture() -> &'static str {
        unsafe {
            if CGPreflightScreenCaptureAccess() {
                "granted"
            } else {
                "denied"
            }
        }
    }

    /// Request microphone access — shows native dialog if not yet determined.
    /// Blocks until the user responds or timeout.
    pub fn request_microphone_access() -> bool {
        use block::ConcreteBlock;
        use objc::runtime::Class;
        use objc::{msg_send, sel, sel_impl};
        use std::sync::mpsc;
        use std::time::Duration;

        let (tx, rx) = mpsc::channel();

        unsafe {
            let cls = match Class::get("AVCaptureDevice") {
                Some(c) => c,
                None => return false,
            };
            let ns_string = match Class::get("NSString") {
                Some(c) => c,
                None => return false,
            };

            let audio_type: *mut objc::runtime::Object =
                msg_send![ns_string, stringWithUTF8String: b"soun\0".as_ptr()];

            let block = ConcreteBlock::new(move |granted: bool| {
                let _ = tx.send(granted);
            });
            let block = block.copy();

            let _: () = msg_send![
                cls,
                requestAccessForMediaType: audio_type
                completionHandler: &*block
            ];
        }

        // Wait up to 2 minutes for user response
        rx.recv_timeout(Duration::from_secs(120)).unwrap_or(false)
    }

    /// Request screen capture access — opens System Preferences
    pub fn request_screen_capture() {
        unsafe {
            CGRequestScreenCaptureAccess();
        }
    }
}

// ── Tauri commands ──

#[tauri::command]
pub async fn check_permissions() -> Result<PermissionStatus, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(PermissionStatus {
            microphone: macos::check_microphone().to_string(),
            screen_audio: macos::check_screen_capture().to_string(),
            overlay: "granted".to_string(),
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(PermissionStatus {
            microphone: "granted".to_string(),
            screen_audio: "granted".to_string(),
            overlay: "granted".to_string(),
        })
    }
}

#[tauri::command]
pub async fn request_permission(kind: String) -> Result<bool, String> {
    log::info!("Requesting permission: {}", kind);

    #[cfg(target_os = "macos")]
    {
        match kind.as_str() {
            "microphone" => {
                let status = macos::check_microphone();
                match status {
                    "unknown" => {
                        // Not yet determined — show native dialog (blocking)
                        let granted =
                            tokio::task::spawn_blocking(|| macos::request_microphone_access())
                                .await
                                .map_err(|e| e.to_string())?;
                        Ok(granted)
                    }
                    "denied" => {
                        // Already denied — open System Settings
                        open_system_settings("microphone".to_string()).await?;
                        Ok(false)
                    }
                    _ => Ok(true), // Already granted
                }
            }
            "screen_audio" => {
                // CGRequestScreenCaptureAccess adds app to list and opens System Settings
                macos::request_screen_capture();
                Ok(false) // User must enable manually in Settings
            }
            _ => Ok(true),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = kind;
        Ok(true)
    }
}

#[tauri::command]
pub async fn open_system_settings(panel: String) -> Result<(), String> {
    let url = match panel.as_str() {
        "microphone" => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        }
        "screen_audio" => {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
        }
        _ => "x-apple.systempreferences:com.apple.preference.security",
    };

    std::process::Command::new("open")
        .arg(url)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}
