use loro::LoroDoc;
use std::fs;
use std::sync::Mutex;
use tauri::ipc::Response;
use tauri::State;

struct AppState {
    doc: Mutex<LoroDoc>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn read_file(path: String) -> String {
    let text = fs::read_to_string(path).expect("file error");
    return text;
}

#[tauri::command]
fn loro_get_text(state: State<AppState>) -> String {
    let doc = state.doc.lock().unwrap();
    let text = doc.get_text("markdown");
    text.to_string()
}

#[tauri::command]
fn loro_update_text(
    state: State<AppState>,
    start: usize,
    delete_count: usize,
    insert_text: String,
) {
    let doc = state.doc.lock().unwrap();
    let text = doc.get_text("markdown");

    if delete_count > 0 {
        text.delete(start, delete_count).unwrap();
    }
    if !insert_text.is_empty() {
        text.insert(start, &insert_text).unwrap();
    }
}

#[tauri::command]
fn parse_markdown(markdown: String) -> Response {
    let parser = pulldown_cmark::Parser::new(&markdown);
    let mut html = String::new();
    pulldown_cmark::html::push_html(&mut html, parser);
    return Response::new(html.as_bytes().to_vec());
}

#[tauri::command]
fn save_markdown(markdown: String) {
    fs::write("huge_markdown.md", markdown).expect("file error");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let doc = LoroDoc::new();

    tauri::Builder::default()
        .manage(AppState {
            doc: Mutex::new(doc),
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            read_file,
            loro_get_text,
            loro_update_text,
            parse_markdown,
            save_markdown,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
