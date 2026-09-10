// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn get_storage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))?;

    if !base_dir.exists() {
        fs::create_dir_all(&base_dir)
            .map_err(|e| format!("Failed to create storage directory: {}", e))?;
    }

    Ok(base_dir.join("shard_a.vault"))
}

#[tauri::command]
fn save_shard_a(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let file_path = get_storage_path(&app)?;
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600) // Restricted permissions: owner read/write only
            .open(&file_path)
            .map_err(|e| format!("Failed to open keystore file: {}", e))?;
        file.write_all(key.as_bytes())
            .map_err(|e| format!("Failed to write keystore file: {}", e))?;
    }

    #[cfg(not(unix))]
    {
        fs::write(&file_path, key.as_bytes())
            .map_err(|e| format!("Failed to write keystore file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn load_shard_a(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let file_path = get_storage_path(&app)?;
    if !file_path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read keystore file: {}", e))?;
    
    let trimmed = contents.trim().to_string();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        Ok(Some(trimmed))
    }
}

#[tauri::command]
fn has_shard_a(app: tauri::AppHandle) -> Result<bool, String> {
    let file_path = get_storage_path(&app)?;
    Ok(file_path.exists())
}

#[tauri::command]
fn delete_shard_a(app: tauri::AppHandle) -> Result<bool, String> {
    let file_path = get_storage_path(&app)?;
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to remove keystore file: {}", e))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_shard_a,
            load_shard_a,
            has_shard_a,
            delete_shard_a
        ])
        .run(tauri::generate_context!())
        .expect("error while running PRIVATUM desktop application");
}
