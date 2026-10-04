import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, expect, it } from 'vitest';
import { openDatabase } from '../../src/lib/db/sqlite';
import { addPeriod, checkIn, deletePeriod, enroll, isOpen, status, validateDescriptor } from '../../src/lib/attendance/service';
import { readAttendanceJson, requireAdmin } from '../../src/lib/attendance/http';

const descriptor = Array(128).fill(0.01) as number[];
process.env.ATTENDANCE_KEY = '01'.repeat(32);

beforeEach(() => {
  process.env.DATABASE_PATH = join(tmpdir(), `attendance-${randomUUID()}.sqlite`);
  const db = openDatabase(process.env.DATABASE_PATH);
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run('student-1', 'one@example.com', 'test', 1);
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run('student-2', 'two@example.com', 'test', 1);
  db.close();
});

it('opens exactly the five minutes after a period starts', () => {
  expect(isOpen('09:00', 8 * 60 + 59)).toBe(false);
  expect(isOpen('09:00', 9 * 60)).toBe(true);
  expect(isOpen('09:00', 9 * 60 + 4)).toBe(true);
  expect(isOpen('09:00', 9 * 60 + 5)).toBe(false);
});

it('migrates an identity-only database while preserving its users', () => {
  const path = join(tmpdir(), `attendance-v1-${randomUUID()}.sqlite`);
  const legacy = new DatabaseSync(path);
  legacy.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE sessions (token_digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE INDEX sessions_user_id ON sessions(user_id);
    INSERT INTO users (id, email, password_hash, created_at) VALUES ('legacy', 'legacy@example.com', 'hash', 1);
    PRAGMA user_version = 1;
  `);
  legacy.close();
  const migrated = openDatabase(path);
  try {
    expect(migrated.prepare('PRAGMA user_version').get()).toEqual({ user_version: 2 });
    expect(migrated.prepare('SELECT email FROM users WHERE id = ?').get('legacy')).toEqual({ email: 'legacy@example.com' });
    expect(migrated.prepare('SELECT count(*) AS count FROM attendance_periods').get()).toEqual({ count: 10 });
  } finally { migrated.close(); }
});

it('records one attendance per enrolled student, date, and period', () => {
  const now = new Date('2026-10-05T03:31:00.000Z'); // Monday 09:01 in Asia/Kolkata
  const periods = status('student-1', now).periods;
  const first = periods.find((period) => period.start_time === '09:00')!;
  const second = periods.find((period) => period.start_time === '09:45')!;
  expect(() => checkIn('student-1', first.id, descriptor, now)).toThrow('Enroll');
  enroll('student-1', descriptor);
  expect(checkIn('student-1', first.id, descriptor, now).status).toBe('present');
  expect(checkIn('student-1', first.id, descriptor, now).status).toBe('already-recorded');
  expect(checkIn('student-1', first.id, descriptor, new Date('2026-10-05T03:35:00.000Z'))).toEqual({ status: 'already-recorded', recordedAt: now.getTime() });
  expect(() => checkIn('student-1', second.id, descriptor, now)).toThrow('not open');
  expect(() => checkIn('student-1', second.id, descriptor, new Date('2026-10-05T04:20:00.000Z'))).toThrow('not open');
  expect(status('student-1', now).periods.find((period) => period.id === first.id)?.recordedAt).toBe(now.getTime());
  expect(status('student-2', now).periods.find((period) => period.id === first.id)?.recordedAt).toBeNull();
});

it('rejects a mismatched descriptor and invalid input', () => {
  const now = new Date('2026-10-05T03:31:00.000Z');
  const first = status('student-1', now).periods[0]!;
  enroll('student-1', descriptor);
  expect(() => checkIn('student-1', first.id, Array(128).fill(1) as number[], now)).toThrow('did not match');
  expect(() => validateDescriptor([1, 2])).toThrow('Capture exactly one clear face');
});

it('rejects malformed timetable input and protects recorded periods from deletion', () => {
  expect(() => addPeriod(1, '09:00', null)).toThrow('Enter a weekday');
  expect(() => addPeriod(1, '09:00', { name: 'Period' })).toThrow('Enter a weekday');
  expect(() => addPeriod(1, 900, 'Period')).toThrow('Enter a weekday');
  const now = new Date('2026-10-05T03:31:00.000Z');
  const first = status('student-1', now).periods[0]!;
  enroll('student-1', descriptor);
  checkIn('student-1', first.id, descriptor, now);
  expect(() => deletePeriod(first.id)).toThrow('cannot be removed');
  expect(status('student-1', now).periods.find((period) => period.id === first.id)?.recordedAt).toBe(now.getTime());
});

it('rejects non-admin access and oversized JSON before parsing it', async () => {
  process.env.ADMIN_EMAIL = 'admin@example.com';
  expect(() => requireAdmin('student@example.com')).toThrow('Admin access is required');
  expect(() => requireAdmin('ADMIN@example.com')).not.toThrow();
  const request = new Request('http://localhost/api/attendance/periods', {
    method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: '{' + ' '.repeat(8192),
  });
  await expect(readAttendanceJson(request)).rejects.toMatchObject({ status: 413, code: 'payload_too_large' });
});

it('requires an exactly 64-character hex encryption key', () => {
  process.env.ATTENDANCE_KEY = '01'.repeat(32) + 'invalid';
  try { expect(() => enroll('student-1', descriptor)).toThrow('64 hex characters'); }
  finally { process.env.ATTENDANCE_KEY = '01'.repeat(32); }
});
