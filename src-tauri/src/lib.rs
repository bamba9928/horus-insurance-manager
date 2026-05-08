mod commands;
mod db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:assurauto.db", db::get_migrations())
                .build(),
        )
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::backup::backup_database,
            commands::backup::restore_database,
            commands::verification::verify_contract,
            commands::external::open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
