#[tauri::command]
fn app_executable_mtime_unix() -> Option<u64> {
    let meta = std::env::current_exe().ok()?.metadata().ok()?;
    let modified = meta.modified().ok()?;
    Some(
        modified
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?
            .as_secs(),
    )
}

#[cfg(not(debug_assertions))]
use std::net::{SocketAddr, TcpStream};
#[cfg(not(debug_assertions))]
use std::sync::Mutex;
#[cfg(not(debug_assertions))]
use std::time::{Duration, Instant};

#[cfg(not(debug_assertions))]
use tauri_plugin_shell::process::CommandChild;

#[cfg(not(debug_assertions))]
struct SidecarChild(Mutex<Option<CommandChild>>);

#[cfg(not(debug_assertions))]
impl Drop for SidecarChild {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![app_executable_mtime_unix])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(not(debug_assertions))]
            {
                use tauri::Manager;
                use tauri_plugin_shell::ShellExt;

                let app_dir = app.path().app_data_dir()?;
                std::fs::create_dir_all(&app_dir)?;
                let db_path = app_dir.join("shigawire.sqlite");
                let db_str = db_path.to_string_lossy().into_owned();

                let sidecar = app.shell().sidecar("shigawire-server").map_err(|e| {
                    log::error!("sidecar resolve failed: {}", e);
                    e
                })?;

                let (_rx, child) = sidecar
                    .env("PORT", "18453")
                    .env("DB_PATH", db_str)
                    .spawn()
                    .map_err(|e| {
                        log::error!("sidecar spawn failed: {}", e);
                        e
                    })?;

                app.manage(SidecarChild(Mutex::new(Some(child))));
                wait_for_sidecar_tcp(18453);
                log::info!("shigawire-server sidecar ready on port 18453");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
