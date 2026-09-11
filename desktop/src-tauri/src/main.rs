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

const KEYRING_SERVICE: &str = "com.privatum.desktop";

#[tauri::command]
fn save_shard_to_keychain(app: tauri::AppHandle, account_id: String, key: String) -> Result<(), String> {
    let mut _saved_keychain = false;
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &account_id) {
        if entry.set_password(&key).is_ok() {
            _saved_keychain = true;
        }
    }

    // Also persist in restricted local vault directory
    if let Ok(base_dir) = app.path().app_data_dir() {
        let shards_dir = base_dir.join("shards");
        let _ = fs::create_dir_all(&shards_dir);
        let file_path = shards_dir.join(format!("{}.vault", account_id));
        
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            use std::io::Write;
            if let Ok(mut file) = fs::OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .mode(0o600)
                .open(&file_path)
            {
                let _ = file.write_all(key.as_bytes());
            }
        }
        #[cfg(not(unix))]
        {
            let _ = fs::write(&file_path, key.as_bytes());
        }
    }

    if account_id == "primary" || account_id == "default" {
        let _ = save_shard_a(app, key);
    }

    Ok(())
}

#[tauri::command]
fn get_shard_from_keychain(app: tauri::AppHandle, account_id: String) -> Result<Option<String>, String> {
    // 1. Try OS Keychain
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &account_id) {
        if let Ok(secret) = entry.get_password() {
            let trimmed = secret.trim().to_string();
            if !trimmed.is_empty() {
                return Ok(Some(trimmed));
            }
        }
    }

    // 2. Try shards/<account_id>.vault
    if let Ok(base_dir) = app.path().app_data_dir() {
        let file_path = base_dir.join("shards").join(format!("{}.vault", account_id));
        if file_path.exists() {
            if let Ok(contents) = fs::read_to_string(&file_path) {
                let trimmed = contents.trim().to_string();
                if !trimmed.is_empty() {
                    return Ok(Some(trimmed));
                }
            }
        }
    }

    // 3. Fallback for primary/default
    if account_id == "primary" || account_id == "default" {
        return load_shard_a(app);
    }

    Ok(None)
}

#[tauri::command]
fn delete_shard_from_keychain(app: tauri::AppHandle, account_id: String) -> Result<bool, String> {
    let mut deleted = false;
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &account_id) {
        if entry.delete_password().is_ok() {
            deleted = true;
        }
    }

    if let Ok(base_dir) = app.path().app_data_dir() {
        let file_path = base_dir.join("shards").join(format!("{}.vault", account_id));
        if file_path.exists() {
            let _ = fs::remove_file(file_path);
            deleted = true;
        }
    }

    if account_id == "primary" || account_id == "default" {
        let _ = delete_shard_a(app);
    }

    Ok(deleted)
}

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Prevent WebKitGTK DMA-BUF EGL display failure on Linux (Mesa/Wayland/NVIDIA)
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_shard_a,
            load_shard_a,
            has_shard_a,
            delete_shard_a,
            save_shard_to_keychain,
            get_shard_from_keychain,
            delete_shard_from_keychain
        ])
        .run(tauri::generate_context!())
        .expect("error while running PRIVATUM desktop application");
}
