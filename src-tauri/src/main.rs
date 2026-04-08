use std::sync::mpsc;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
fn pick_workspace_directory<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<Option<String>, String> {
    let (sender, receiver) = mpsc::channel();

    app.dialog().file().pick_folder(move |folder_path| {
        let selected = folder_path.map(|path| path.to_string());
        let _ = sender.send(selected);
    });

    receiver.recv().map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![pick_workspace_directory])
        .run(tauri::generate_context!())
        .expect("failed to run AgentCanvas desktop app");
}
