mod commands;
mod domain;
mod model;
mod runner;
mod seed;
mod store;
mod ytdlp;

use commands::AppState;
use model::Preset;
use store::Store;

/// `%APPDATA%\qDLP\library.db` — same known-folder resolution runner.rs uses
/// for the bin dir, for the same reason: the raw env var can carry stray
/// whitespace/quoting that `dirs` sidesteps.
fn db_path() -> std::path::PathBuf {
    let dir = dirs::data_dir()
        .or_else(|| std::env::var_os("APPDATA").map(std::path::PathBuf::from))
        .unwrap_or_else(std::env::temp_dir)
        .join("qDLP");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("library.db")
}

/// Default download folder for the seed presets: the OS Downloads folder if
/// resolvable, else the app-data directory — always something writable
/// rather than an empty string a fresh install would otherwise ship with.
fn default_download_dir() -> String {
    dirs::download_dir().map(|d| d.to_string_lossy().to_string()).unwrap_or_else(|| db_path().to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    seed::seed_binaries();

    let store = Store::open(db_path().to_str().expect("db path is valid UTF-8")).expect("failed to open the library database");

    // Mirrors rustyDLP's fresh-install seeding: an empty preset table gets
    // Preset::seeds so Settings/New Download aren't blank on first launch.
    if store.load_presets().map(|p| p.is_empty()).unwrap_or(false) {
        for preset in Preset::seeds(&default_download_dir()) {
            let _ = store.save_preset(&preset);
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new(store))
        .invoke_handler(tauri::generate_handler![
            commands::probe_url,
            commands::create_download,
            commands::create_convert,
            commands::retry_job,
            commands::cancel_job,
            commands::list_jobs,
            commands::get_job,
            commands::delete_job,
            commands::list_presets,
            commands::save_preset,
            commands::delete_preset,
            commands::get_setting,
            commands::set_setting,
            commands::update_ytdlp,
            commands::open_file,
            commands::reveal_file,
            commands::open_bin_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
