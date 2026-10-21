use crate::models::*;
use std::sync::OnceLock;
use tauri_plugin_sql::Migration;
use tokio::sync::Mutex;

pub static DB: OnceLock<Mutex<Option<tauri_plugin_sql::Pool>>> = OnceLock::new();

pub fn get_db_pool() -> Option<&'static Mutex<Option<tauri_plugin_sql::Pool>>> {
    DB.get()
}

pub async fn init_db(pool: tauri_plugin_sql::Pool) -> Result<(), String> {
    let mut db = DB.get_or_init(|| Mutex::new(None)).lock().await;
    *db = Some(pool);
    Ok(())
}

pub async fn execute_sql(sql: &str) -> Result<(), String> {
    let db = DB.get().ok_or("Database not initialized")?;
    let db_lock = db.lock().await;
    let pool = db_lock.as_ref().ok_or("Database pool not available")?;
    pool.execute(sql, []).await.map_err(|e| e.to_string())
}

pub async fn query_sql<T, F>(sql: &str, params: &[&dyn tauri_plugin_sql::ToSql], mapper: F) -> Result<Vec<T>, String>
where
    F: Fn(&tauri_plugin_sql::Row) -> Result<T, String> + Send + Sync,
{
    let db = DB.get().ok_or("Database not initialized")?;
    let db_lock = db.lock().await;
    let pool = db_lock.as_ref().ok_or("Database pool not available")?;
    let rows = pool.select(sql, params, |row| mapper(row)).await.map_err(|e| e.to_string())?;
    Ok(rows)
}

// ─── Schema Migrations ──────────────────────────────────────────────────

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "Create initial schema",
            sql: include_str!("../migrations/001_initial.sql"),
        },
        Migration {
            version: 2,
            description: "Add officers and deductions tables",
            sql: include_str!("../migrations/002_officers_deductions.sql"),
        },
        Migration {
            version: 3,
            description: "Add settings and AI config",
            sql: include_str!("../migrations/003_settings_ai.sql"),
        },
    ]
}
