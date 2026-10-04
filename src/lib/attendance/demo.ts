import { openDatabase } from '../db/sqlite';
import { HttpError } from '../auth/http';
import { databasePath, decryptDescriptor, encryptDescriptor, MATCH_LIMIT, validateDescriptor } from './service';

export function demoStatus(userId: string) {
  const db = openDatabase(databasePath());
  try {
    const enrolled = Boolean(db.prepare('SELECT 1 FROM attendance_demo_references WHERE user_id = ?').get(userId));
    const record = db.prepare('SELECT recorded_at FROM attendance_demo_records WHERE user_id = ?').get(userId) as { recorded_at: number } | undefined;
    return { enrolled, recordedAt: record?.recorded_at ?? null };
  } finally { db.close(); }
}

export function enrollDemo(userId: string, descriptor: number[]) {
  const encrypted = encryptDescriptor(validateDescriptor(descriptor));
  const db = openDatabase(databasePath());
  try {
    db.exec('BEGIN');
    db.prepare('INSERT INTO attendance_demo_references (user_id, encrypted_descriptor, enrolled_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET encrypted_descriptor = excluded.encrypted_descriptor, enrolled_at = excluded.enrolled_at').run(userId, encrypted, Date.now());
    db.prepare('DELETE FROM attendance_demo_records WHERE user_id = ?').run(userId);
    db.exec('COMMIT');
  } finally { db.close(); }
}

export function checkInDemo(userId: string, descriptor: number[], now = new Date()) {
  validateDescriptor(descriptor);
  const db = openDatabase(databasePath());
  try {
    // Keep reference replacement and matching within one transaction.
    db.exec('BEGIN IMMEDIATE');
    const enrollment = db.prepare('SELECT encrypted_descriptor FROM attendance_demo_references WHERE user_id = ?').get(userId) as { encrypted_descriptor: string } | undefined;
    if (!enrollment) throw new HttpError(409, 'not_enrolled', 'Save a demo reference selfie first.');
    const reference = decryptDescriptor(enrollment.encrypted_descriptor);
    const distance = Math.hypot(...descriptor.map((value, index) => value - reference[index]));
    if (distance >= MATCH_LIMIT) throw new HttpError(422, 'face_mismatch', 'Face did not match your demo reference. This attempt was not marked Present.');
    const recordedAt = now.getTime();
    db.prepare('INSERT INTO attendance_demo_records (user_id, recorded_at, distance) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET recorded_at = excluded.recorded_at, distance = excluded.distance').run(userId, recordedAt, distance);
    db.exec('COMMIT');
    return { status: 'present', recordedAt };
  } finally { db.close(); }
}

export function resetDemo(userId: string) {
  const db = openDatabase(databasePath());
  try { db.prepare('DELETE FROM attendance_demo_records WHERE user_id = ?').run(userId); }
  finally { db.close(); }
}

export function deleteDemo(userId: string) {
  const db = openDatabase(databasePath());
  try {
    db.exec('BEGIN');
    db.prepare('DELETE FROM attendance_demo_records WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM attendance_demo_references WHERE user_id = ?').run(userId);
    db.exec('COMMIT');
  } finally { db.close(); }
}
