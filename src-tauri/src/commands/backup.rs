// Commandes de backup/restore de la base SQLite (Phase 11).
//
// Stratégie : le fichier DB est géré par tauri-plugin-sql dans
// `app_data_dir()/assurauto.db`. Les commandes exposent un export binaire
// (lecture brute du fichier) et un import binaire (écrasement du fichier).
//
// Le frontend télécharge l'export via un Blob navigateur et pousse le
// contenu d'un fichier restauré via `invoke`. L'utilisateur doit redémarrer
// l'application après une restauration pour que la connexion SQL rouvre
// le nouveau fichier.

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Retourne le chemin absolu du fichier SQLite géré par tauri-plugin-sql.
/// Le plugin stocke les DB dans `app_data_dir()/<db_name>`.
fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir introuvable : {e}"))?;
    Ok(dir.join("assurauto.db"))
}

/// Lit la base SQLite et renvoie son contenu binaire.
/// Le frontend reçoit un `Vec<u8>` (sérialisé en JSON array of numbers par Tauri)
/// qu'il pourra transformer en Blob téléchargeable.
#[tauri::command]
pub fn backup_database(app: AppHandle) -> Result<Vec<u8>, String> {
    let path = db_path(&app)?;
    if !path.exists() {
        return Err(format!(
            "Base introuvable : {}",
            path.display()
        ));
    }
    fs::read(&path).map_err(|e| format!("Lecture backup échouée : {e}"))
}

/// Restaure la base SQLite à partir d'un contenu binaire fourni.
/// Crée d'abord un backup de sécurité de l'ancien fichier (`assurauto.db.bak`)
/// puis écrit les nouvelles données.
/// L'utilisateur doit redémarrer l'application pour rouvrir la nouvelle base.
#[tauri::command]
pub fn restore_database(app: AppHandle, bytes: Vec<u8>) -> Result<String, String> {
    if bytes.len() < 16 {
        return Err("Fichier invalide : trop petit pour être une base SQLite.".into());
    }
    // Validation sommaire : les bases SQLite commencent par "SQLite format 3\0".
    const SQLITE_MAGIC: &[u8] = b"SQLite format 3\0";
    if !bytes.starts_with(SQLITE_MAGIC) {
        return Err("Fichier invalide : en-tête SQLite manquant.".into());
    }

    let path = db_path(&app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "Chemin parent introuvable".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("Création dossier échouée : {e}"))?;

    // Sauvegarde de sécurité de l'ancienne DB si elle existe
    if path.exists() {
        let backup = path.with_extension("db.bak");
        fs::copy(&path, &backup)
            .map_err(|e| format!("Backup de sécurité échoué : {e}"))?;
    }

    fs::write(&path, &bytes).map_err(|e| format!("Écriture restauration échouée : {e}"))?;
    Ok(format!("Restauration OK : {}", path.display()))
}
