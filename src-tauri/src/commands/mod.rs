pub mod clients;
pub mod vehicules;
pub mod polices;
pub mod paiements;
pub mod exports;
pub mod backup;

/// Commande de test pour vérifier que l'IPC fonctionne
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Bienvenue, {} ! Horus Assurances Manager est prêt.", name)
}
