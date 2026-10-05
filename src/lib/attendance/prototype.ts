import { openDatabase } from '../db/sqlite';
import { databasePath, encryptBytes, decryptBytes, encryptDescriptor, status, checkIn } from './service';
import { HttpError } from '../auth/http';

const studentId = 'prototype-student';

export function initializePrototype() {
  const db = openDatabase(databasePath());
  try {
    db.exec('BEGIN IMMEDIATE');
    const added = db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(studentId, 'prototype@student.local', 'no-login-prototype', Date.now());
    if (added.changes) {
      for (let day = 0; day < 7; day++) {
        const rows = db.prepare('SELECT start_time FROM attendance_periods WHERE weekday = ? ORDER BY start_time').all(day) as { start_time: string }[];
        const last = rows.at(-1)?.start_time;
        const [hour, minute] = (last ?? '08:00').split(':').map(Number);
        for (let index = rows.length; index < 7; index++) {
          const start = (hour * 60 + minute) + (index - rows.length + 1) * 60;
          if (start >= 1380) break;
          const time = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
          db.prepare('INSERT INTO attendance_periods (weekday, start_time, name) VALUES (?, ?, ?)').run(day, time, `Period ${index + 1}`);
        }
      }
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}

export function prototypeStatus(now = new Date()) {
  initializePrototype();
  const db = openDatabase(databasePath());
  try {
    const saved = db.prepare('SELECT saved_at FROM prototype_photos WHERE user_id = ?').get(studentId) as { saved_at: number } | undefined;
    return { ...status(studentId, now, true), photoSavedAt: saved?.saved_at ?? null };
  } finally { db.close(); }
}

export function savePrototypePhoto(photo: Buffer, descriptor: number[]) {
  initializePrototype();
  const db = openDatabase(databasePath());
  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare('INSERT INTO face_enrollments (user_id, encrypted_descriptor, enrolled_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET encrypted_descriptor = excluded.encrypted_descriptor, enrolled_at = excluded.enrolled_at').run(studentId, encryptDescriptor(descriptor), Date.now());
    db.prepare('INSERT INTO prototype_photos (user_id, encrypted_photo, saved_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET encrypted_photo = excluded.encrypted_photo, saved_at = excluded.saved_at').run(studentId, encryptBytes(photo), Date.now());
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}

export function prototypePhoto() {
  initializePrototype();
  const db = openDatabase(databasePath());
  try {
    const row = db.prepare('SELECT encrypted_photo FROM prototype_photos WHERE user_id = ?').get(studentId) as { encrypted_photo: string } | undefined;
    if (!row) throw new HttpError(404, 'no_photo', 'Save a photo first.');
    return decryptBytes(row.encrypted_photo);
  } finally { db.close(); }
}

export function removePrototypePhoto(resetAttendance = false) {
  initializePrototype();
  const db = openDatabase(databasePath());
  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare('DELETE FROM prototype_photos WHERE user_id = ?').run(studentId);
    db.prepare('DELETE FROM face_enrollments WHERE user_id = ?').run(studentId);
    if (resetAttendance) db.prepare('DELETE FROM attendance_records WHERE user_id = ?').run(studentId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}

export function resetPrototypeStudent() {
  removePrototypePhoto(true);
}

export function prototypeCheckIn(descriptor: number[], now = new Date()) {
  const current = prototypeStatus(now).periods.find((period) => period.open);
  if (!current) throw new HttpError(409, 'outside_window', 'No period is active right now. Ask Admin to edit today’s timetable.');
  return { ...checkIn(studentId, current.id, descriptor, now, true), periodName: current.name };
}
