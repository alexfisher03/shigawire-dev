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
use std::io::{Read, Write};
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
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
    }
}

#[cfg(not(debug_assertions))]
fn http_response_status_ok(buf: &[u8]) -> bool {
    let line_end = buf
        .iter()
        .position(|&b| b == b'\r' || b == b'\n')
        .unwrap_or(buf.len());
    let line = &buf[..line_end];
    // "HTTP/1.x 200 ..."
    line.windows(3).any(|w| w == b"200")
}

/// Wait until Fiber returns 200 for GET /healthz (TCP accept can happen before HTTP is fully ready).
#[cfg(not(debug_assertions))]
fn wait_for_sidecar_http(port: u16) {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let deadline = Instant::now() + Duration::from_secs(45);
    while Instant::now() < deadline {
        match TcpStream::connect_timeout(&addr, Duration::from_millis(500)) {
            Ok(mut stream) => {
                let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                let req = concat!(
                    "GET /healthz HTTP/1.1\r\n",
                    "Host: 127.0.0.1\r\n",
                    "Connection: close\r\n",
                    "\r\n"
                );
                if stream.write_all(req.as_bytes()).is_ok() {
                    let mut buf = [0u8; 256];
                    if let Ok(n) = stream.read(&mut buf) {
                        if n > 0 && http_response_status_ok(&buf[..n]) {
                            log::info!("sidecar HTTP /healthz ready on 127.0.0.1:{}", port);
                            return;
                        }
                    }
                }
            }
            Err(_) => {}
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    log::warn!(
        "timed out waiting for sidecar HTTP on port {}; UI may show errors until the server is ready",
        port
    );
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
                wait_for_sidecar_http(18453);
                log::info!("shigawire-server sidecar ready on port 18453");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
