import type { DatabaseSync } from 'node:sqlite';

export function initializeSchema(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON');
  const version = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (version.user_version > 3) throw new Error('Database schema is newer than this application');
  if (version.user_version === 0) db.exec(`
    BEGIN;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE sessions (
      token_digest TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX sessions_user_id ON sessions(user_id);
    PRAGMA user_version = 1;
    COMMIT;
  `);
  if (version.user_version < 2) db.exec(`
    BEGIN;
    CREATE TABLE attendance_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      start_time TEXT NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE face_enrollments (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      encrypted_descriptor TEXT NOT NULL,
      enrolled_at INTEGER NOT NULL
    );
    CREATE TABLE attendance_records (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period_id INTEGER NOT NULL REFERENCES attendance_periods(id),
      local_date TEXT NOT NULL,
      recorded_at INTEGER NOT NULL,
      distance REAL NOT NULL,
      PRIMARY KEY (user_id, period_id, local_date)
    );
    INSERT INTO attendance_periods (weekday, start_time, name)
    SELECT day, '09:00', 'Period 1' FROM (SELECT 1 AS day UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5);
    INSERT INTO attendance_periods (weekday, start_time, name)
    SELECT day, '09:45', 'Period 2' FROM (SELECT 1 AS day UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5);
    PRAGMA user_version = 2;
    COMMIT;
  `);
  if (version.user_version < 3) db.exec(`
    BEGIN;
    CREATE TABLE attendance_demo_references (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      encrypted_descriptor TEXT NOT NULL,
      enrolled_at INTEGER NOT NULL
    );
    CREATE TABLE attendance_demo_records (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      recorded_at INTEGER NOT NULL,
      distance REAL NOT NULL
    );
    PRAGMA user_version = 3;
    COMMIT;
  `);
}
