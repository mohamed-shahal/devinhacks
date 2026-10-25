import Database from 'better-sqlite3';
import { chmod, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const path = resolve(process.cwd(), '.local/scenecraft.sqlite');
await mkdir(resolve(process.cwd(), '.local'), { recursive: true, mode: 0o700 });
export const database = new Database(path);
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');
database.exec(
  `CREATE TABLE IF NOT EXISTS provider_connections(id TEXT PRIMARY KEY,label TEXT NOT NULL,provider TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,encrypted_credential TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS models(id TEXT PRIMARY KEY,connection_id TEXT NOT NULL REFERENCES provider_connections(id) ON DELETE CASCADE,label TEXT NOT NULL,capabilities TEXT NOT NULL,created_at INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS task_assignments(task TEXT PRIMARY KEY,model_id TEXT NOT NULL,updated_at INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE IF NOT EXISTS usage(id TEXT PRIMARY KEY,task TEXT NOT NULL,model_id TEXT NOT NULL,created_at INTEGER NOT NULL,latency_ms INTEGER NOT NULL,category TEXT NOT NULL);CREATE TABLE IF NOT EXISTS video_jobs(id TEXT PRIMARY KEY,provider_task_id TEXT NOT NULL,connection_id TEXT NOT NULL,created_at INTEGER NOT NULL,status TEXT NOT NULL);`,
);
await chmod(path, 0o600);
