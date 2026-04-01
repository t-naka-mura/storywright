use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

/// プロジェクトルート（src-tauri/ の親ディレクトリ）を取得
fn project_root() -> PathBuf {
    let manifest_dir = std::env!("CARGO_MANIFEST_DIR");
    PathBuf::from(manifest_dir)
        .parent()
        .expect("Failed to get project root")
        .to_path_buf()
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn run_story(story_json: String) -> Result<serde_json::Value, String> {
    // ブロッキング処理を別スレッドで実行してメインスレッドを解放
    tauri::async_runtime::spawn_blocking(move || {
        let root = project_root();
        let runner_dir = root.join("runner");
        let runner_script = runner_dir.join("run.mjs");

        let home = std::env::var("HOME").unwrap_or_default();
        let current_path = std::env::var("PATH").unwrap_or_default();
        let extended_path = format!(
            "{}/.asdf/shims:{}/.asdf/bin:/usr/local/bin:{}",
            home, home, current_path
        );

        let mut child = Command::new("node")
            .arg(&runner_script)
            .current_dir(&runner_dir)
            .env("PATH", &extended_path)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start runner: {}", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(story_json.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        }

        let output = child
            .wait_with_output()
            .map_err(|e| format!("Failed to wait for runner: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if stdout.is_empty() {
            return Err(format!("Runner produced no output. stderr: {}", stderr));
        }

        serde_json::from_str(&stdout).map_err(|e| {
            format!(
                "Failed to parse runner output: {}. stdout: {}, stderr: {}",
                e, stdout, stderr
            )
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn open_preview(app: tauri::AppHandle, url: String) -> Result<(), String> {
    // 既存のプレビューウィンドウがあれば閉じる
    if let Some(existing) = app.get_webview_window("preview") {
        let _ = existing.close();
        // 少し待ってから再作成
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }

    tauri::WebviewWindowBuilder::new(&app, "preview", tauri::WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?))
        .title("Storywright Preview")
        .inner_size(1024.0, 768.0)
        .build()
        .map_err(|e| format!("Failed to open preview: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn close_preview(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("preview") {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, run_story, open_preview, close_preview])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
