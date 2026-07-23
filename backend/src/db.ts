import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(__dirname, '..', 'data.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS dashboards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    config     TEXT    NOT NULL,
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS embeds (
    id         TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    payload    TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`)

export default db
