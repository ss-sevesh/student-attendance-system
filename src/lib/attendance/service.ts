import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { openDatabase } from '../db/sqlite';
import { HttpError } from '../auth/http';

const timezone = process.env.ATTENDANCE_TIMEZONE ?? 'Asia/Kolkata';
const keyPath = join(process.cwd(), 'data', 'attendance.key');
export const MATCH_LIMIT = 0.5; // Prototype threshold; not calibrated for real attendance.

export type Period = { id: number; weekday: number; start_time: string; end_time?: string | null; name: string };

export function databasePath() {
  return process.env.DATABASE_PATH ?? join(process.cwd(), 'data', 'student.sqlite');
}

function key(): Buffer {
  if (process.env.ATTENDANCE_KEY) {
    if (!/^[0-9a-fA-F]{64}$/.test(process.env.ATTENDANCE_KEY)) throw new Error('ATTENDANCE_KEY must be 64 hex characters');
    return Buffer.from(process.env.ATTENDANCE_KEY, 'hex');
  }
  if (!existsSync(keyPath)) {
    mkdirSync(dirname(keyPath), { recursive: true });
    try { writeFileSync(keyPath, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (!existsSync(keyPath)) throw error; }
  }
  const stored = readFileSync(keyPath);
  if (stored.length !== 32) throw new Error('Attendance key file must contain 32 bytes');
  return stored;
}

export function encryptDescriptor(value: number[]): string {
  return encryptBytes(Buffer.from(JSON.stringify(value)));
}

export function encryptBytes(value: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export function decryptDescriptor(value: string): number[] {
  return JSON.parse(decryptBytes(value).toString()) as number[];
}

export function decryptBytes(value: string): Buffer {
  const bytes = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
}

export function validateDescriptor(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== 128 || value.some((n) => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 10)) {
    throw new HttpError(400, 'invalid_face', 'Capture exactly one clear face and try again.');
  }
  return value as number[];
}

function campusNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const field = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(field('weekday'));
  return { date: `${field('year')}-${field('month')}-${field('day')}`, weekday, minute: Number(field('hour')) * 60 + Number(field('minute')) };
}

export function isOpen(startTime: string, nowMinute: number) {
  const [hour, minute] = startTime.split(':').map(Number);
  const start = hour * 60 + minute;
  return nowMinute >= start && nowMinute < start + 5;
}

export function periodEnd(period: Period, periods: Period[]) {
  if (period.end_time) return period.end_time;
  const next = periods.filter((row) => row.weekday === period.weekday && row.start_time > period.start_time).sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  if (next) return next.start_time;
  const [hour, minute] = period.start_time.split(':').map(Number);
  const end = Math.min(hour * 60 + minute + 60, 1439);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

export function inPeriodRange(period: Period, periods: Period[], nowMinute: number) {
  const time = `${String(Math.floor(nowMinute / 60)).padStart(2, '0')}:${String(nowMinute % 60).padStart(2, '0')}`;
  return time >= period.start_time && time < periodEnd(period, periods);
}

export function status(userId: string, now = new Date(), fullRange = false) {
  const db = openDatabase(databasePath());
  try {
    const local = campusNow(now);
    const periods = db.prepare('SELECT id, weekday, start_time, end_time, name FROM attendance_periods WHERE weekday = ? ORDER BY start_time, id').all(local.weekday) as Period[];
    const enrolled = Boolean(db.prepare('SELECT 1 FROM face_enrollments WHERE user_id = ?').get(userId));
    const records = db.prepare('SELECT period_id, recorded_at FROM attendance_records WHERE user_id = ? AND local_date = ?').all(userId, local.date) as { period_id: number; recorded_at: number }[];
    return { date: local.date, timezone, periods: periods.map((period) => ({ ...period, end_time: periodEnd(period, periods), open: fullRange ? inPeriodRange(period, periods, local.minute) : isOpen(period.start_time, local.minute), recordedAt: records.find((record) => record.period_id === period.id)?.recorded_at ?? null })), enrolled };
  } finally { db.close(); }
}

export function enroll(userId: string, descriptor: number[]) {
  const db = openDatabase(databasePath());
  try {
    db.prepare('INSERT INTO face_enrollments (user_id, encrypted_descriptor, enrolled_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET encrypted_descriptor = excluded.encrypted_descriptor, enrolled_at = excluded.enrolled_at')
      .run(userId, encryptDescriptor(descriptor), Date.now());
  } finally { db.close(); }
}

export function deleteEnrollment(userId: string) {
  const db = openDatabase(databasePath());
  try { db.prepare('DELETE FROM face_enrollments WHERE user_id = ?').run(userId); }
  finally { db.close(); }
}

export function checkIn(userId: string, periodId: number, descriptor: number[], now = new Date(), fullRange = false) {
  const local = campusNow(now);
  const db = openDatabase(databasePath());
  try {
    const period = db.prepare('SELECT id, weekday, start_time, end_time, name FROM attendance_periods WHERE id = ?').get(periodId) as Period | undefined;
    if (!period || period.weekday !== local.weekday) {
      throw new HttpError(409, 'outside_window', 'This period is not open for check-in.');
    }
    const prior = db.prepare('SELECT recorded_at FROM attendance_records WHERE user_id = ? AND period_id = ? AND local_date = ?').get(userId, periodId, local.date) as { recorded_at: number } | undefined;
    if (prior) return { status: 'already-recorded', recordedAt: prior.recorded_at };
    const dayPeriods = db.prepare('SELECT id, weekday, start_time, end_time, name FROM attendance_periods WHERE weekday = ?').all(local.weekday) as Period[];
    if (!(fullRange ? inPeriodRange(period, dayPeriods, local.minute) : isOpen(period.start_time, local.minute))) {
      throw new HttpError(409, 'outside_window', 'This period is not open for check-in.');
    }
    const enrollment = db.prepare('SELECT encrypted_descriptor FROM face_enrollments WHERE user_id = ?').get(userId) as { encrypted_descriptor: string } | undefined;
    if (!enrollment) throw new HttpError(409, 'not_enrolled', 'Enroll your ID-card portrait first.');
    const reference = decryptDescriptor(enrollment.encrypted_descriptor);
    const distance = Math.hypot(...descriptor.map((value, index) => value - reference[index]));
    if (distance >= MATCH_LIMIT) throw new HttpError(422, 'face_mismatch', 'Face did not match the enrolled portrait. Try again or ask staff for help.');
    const recordedAt = now.getTime();
    const inserted = db.prepare('INSERT OR IGNORE INTO attendance_records (user_id, period_id, local_date, recorded_at, distance) VALUES (?, ?, ?, ?, ?)')
      .run(userId, periodId, local.date, recordedAt, distance);
    if (!inserted.changes) {
      const existing = db.prepare('SELECT recorded_at FROM attendance_records WHERE user_id = ? AND period_id = ? AND local_date = ?')
        .get(userId, periodId, local.date) as { recorded_at: number };
      return { status: 'already-recorded', recordedAt: existing.recorded_at };
    }
    return { status: 'present', recordedAt };
  } finally { db.close(); }
}

export function addPeriod(weekday: unknown, startTime: unknown, name: unknown) {
  if (!Number.isInteger(weekday) || (weekday as number) < 0 || (weekday as number) > 6 ||
    typeof startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
    typeof name !== 'string' || !name.trim() || name.length > 80) {
    throw new HttpError(400, 'invalid_period', 'Enter a weekday, start time, and period name.');
  }
  const db = openDatabase(databasePath());
  try { db.prepare('INSERT INTO attendance_periods (weekday, start_time, name) VALUES (?, ?, ?)').run(weekday as number, startTime as string, (name as string).trim()); }
  finally { db.close(); }
}

export function deletePeriod(id: number) {
  const db = openDatabase(databasePath());
  try {
    const used = db.prepare('SELECT 1 FROM attendance_records WHERE period_id = ?').get(id);
    if (used) throw new HttpError(409, 'period_has_attendance', 'This period has attendance records and cannot be removed.');
    db.prepare('DELETE FROM attendance_periods WHERE id = ?').run(id);
  }
  finally { db.close(); }
}

export function allPeriods(): Period[] {
  const db = openDatabase(databasePath());
  try {
    const rows = db.prepare('SELECT id, weekday, start_time, end_time, name FROM attendance_periods ORDER BY weekday, start_time, id').all() as Period[];
    return rows.map((row) => ({ ...row, end_time: periodEnd(row, rows) }));
  }
  finally { db.close(); }
}

export function saveTimetableDay(weekday: unknown, value: unknown) {
  if (!Number.isInteger(weekday) || (weekday as number) < 0 || (weekday as number) > 6 || !Array.isArray(value) || value.length !== 7) {
    throw new HttpError(400, 'invalid_timetable', 'Choose a weekday and enter exactly seven periods.');
  }
  const rows = value.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new HttpError(400, 'invalid_timetable', 'Enter a name and start time for every period.');
    const { id, name, startTime, endTime } = row as Record<string, unknown>;
    if ((id !== undefined && (!Number.isSafeInteger(id) || (id as number) <= 0)) || typeof name !== 'string' || !name.trim() || name.length > 80 ||
      typeof startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      throw new HttpError(400, 'invalid_timetable', 'Enter a valid name and start time for every period.');
    }
    if (endTime !== undefined && (typeof endTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || endTime <= startTime)) {
      throw new HttpError(400, 'invalid_timetable', 'End time must be later than start time.');
    }
    return { id: id as number | undefined, name: name.trim(), startTime, endTime: endTime as string | undefined };
  });
  if (rows.some((row, index) => index > 0 && row.startTime <= rows[index - 1].startTime)) {
    throw new HttpError(400, 'invalid_timetable', 'Start times must be different and in chronological order.');
  }
  const ids = rows.flatMap((row) => row.id === undefined ? [] : [row.id]);
  if (rows.some((row, index) => index < rows.length - 1 && row.endTime && row.endTime > rows[index + 1].startTime)) {
    throw new HttpError(400, 'invalid_timetable', 'Period ranges must not overlap.');
  }
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'invalid_timetable', 'Each period must appear only once.');
  const db = openDatabase(databasePath());
  try {
    db.exec('BEGIN IMMEDIATE');
    const existing = db.prepare('SELECT id FROM attendance_periods WHERE weekday = ?').all(weekday as number) as { id: number }[];
    if (existing.some((row) => !ids.includes(row.id)) || ids.some((id) => !existing.some((row) => row.id === id))) {
      throw new HttpError(409, 'timetable_changed', 'The timetable changed or has more than seven periods. Reload the editor; remove extra periods first.');
    }
    for (const row of rows) {
      if (row.id !== undefined) db.prepare('UPDATE attendance_periods SET name = ?, start_time = ?, end_time = ? WHERE id = ?').run(row.name, row.startTime, row.endTime ?? null, row.id);
      else db.prepare('INSERT INTO attendance_periods (weekday, start_time, end_time, name) VALUES (?, ?, ?, ?)').run(weekday as number, row.startTime, row.endTime ?? null, row.name);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally { db.close(); }
}
