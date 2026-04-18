use tauri_plugin_sql::{Migration, MigrationKind};

/// Retourne la liste des migrations à appliquer au démarrage.
/// Chaque migration est exécutée dans l'ordre et de manière idempotente.
pub fn get_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "Schema initial : clients, vehicules, assureurs, polices, paiements, audit_log, vues, triggers",
        sql: include_str!("migrations/001_init.sql"),
        kind: MigrationKind::Up,
    }]
}
