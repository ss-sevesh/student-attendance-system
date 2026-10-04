import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, it } from 'vitest';
import { openDatabase } from '../../src/lib/db/sqlite';
import { checkInDemo, deleteDemo, demoStatus, enrollDemo, resetDemo } from '../../src/lib/attendance/demo';
import { checkIn, enroll, status } from '../../src/lib/attendance/service';

const descriptor = Array(128).fill(0) as number[];
const demoTime = new Date('2026-10-04T18:00:00.000Z'); // Sunday, outside every seeded class period.

beforeEach(() => {
  process.env.ATTENDANCE_KEY = '01'.repeat(32);
  process.env.DATABASE_PATH = join(tmpdir(), `attendance-demo-${randomUUID()}.sqlite`);
  const db = openDatabase(process.env.DATABASE_PATH);
  try {
    for (const id of ['one', 'two']) {
      db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(id, `${id}@example.com`, 'test', 1);
    }
  } finally { db.close(); }
});

it('requires a saved demo reference and records a matching face outside class hours', () => {
  expect(demoStatus('one')).toEqual({ enrolled: false, recordedAt: null });
  expect(() => checkInDemo('one', descriptor, demoTime)).toThrow();
  enrollDemo('one', descriptor);
  expect(checkInDemo('one', descriptor, demoTime)).toMatchObject({ status: 'present', recordedAt: demoTime.getTime() });
  expect(demoStatus('one')).toEqual({ enrolled: true, recordedAt: demoTime.getTime() });
  const db = openDatabase(process.env.DATABASE_PATH!);
  try {
    const reference = db.prepare('SELECT encrypted_descriptor FROM attendance_demo_references WHERE user_id = ?').get('one') as { encrypted_descriptor: string };
    expect(reference.encrypted_descriptor).not.toBe(JSON.stringify(descriptor));
    expect(db.prepare('SELECT count(*) AS count FROM attendance_demo_records').get()).toEqual({ count: 1 });
  } finally { db.close(); }
});

it('compares every attempt and rejects faces at or beyond the match limit', () => {
  enrollDemo('one', descriptor);
  const belowLimit = [...descriptor];
  belowLimit[0] = 0.49;
  expect(checkInDemo('one', belowLimit, demoTime).status).toBe('present');
  for (const value of [0.5, 1]) {
    const mismatch = [...descriptor];
    mismatch[0] = value;
    expect(() => checkInDemo('one', mismatch, new Date(demoTime.getTime() + 1000))).toThrow();
    expect(demoStatus('one').recordedAt).toBe(demoTime.getTime());
  }
  const nextTime = new Date(demoTime.getTime() + 2000);
  expect(checkInDemo('one', descriptor, nextTime).recordedAt).toBe(nextTime.getTime());
});

it('keeps demo references and results private to each account', () => {
  enrollDemo('one', descriptor);
  checkInDemo('one', descriptor, demoTime);
  expect(demoStatus('two')).toEqual({ enrolled: false, recordedAt: null });
  expect(() => checkInDemo('two', descriptor, demoTime)).toThrow();
  resetDemo('two');
  deleteDemo('two');
  expect(demoStatus('one')).toEqual({ enrolled: true, recordedAt: demoTime.getTime() });
});

it('resets results, clears results on replacement, and removes demo enrollment', () => {
  enrollDemo('one', descriptor);
  checkInDemo('one', descriptor, demoTime);
  resetDemo('one');
  expect(demoStatus('one')).toEqual({ enrolled: true, recordedAt: null });
  checkInDemo('one', descriptor, demoTime);
  const replacement = Array(128).fill(1) as number[];
  enrollDemo('one', replacement);
  expect(demoStatus('one')).toEqual({ enrolled: true, recordedAt: null });
  expect(() => checkInDemo('one', descriptor, demoTime)).toThrow();
  checkInDemo('one', replacement, demoTime);
  deleteDemo('one');
  expect(demoStatus('one')).toEqual({ enrolled: false, recordedAt: null });
});

it('never enrolls or marks scheduled attendance and preserves existing class records', () => {
  enrollDemo('one', descriptor);
  checkInDemo('one', descriptor, demoTime);
  const classTime = new Date('2026-10-05T03:31:00.000Z');
  expect(status('one', classTime).enrolled).toBe(false);
  expect(status('one', classTime).periods.every((period) => period.recordedAt === null)).toBe(true);
  enroll('one', descriptor);
  const periodId = status('one', classTime).periods[0]!.id;
  checkIn('one', periodId, descriptor, classTime);
  resetDemo('one');
  deleteDemo('one');
  expect(status('one', classTime).enrolled).toBe(true);
  expect(status('one', classTime).periods.find((period) => period.id === periodId)?.recordedAt).toBe(classTime.getTime());
});

it('adds demo tables to a version 2 database without changing existing class data', () => {
  enroll('one', descriptor);
  const classTime = new Date('2026-10-05T03:31:00.000Z');
  const periodId = status('one', classTime).periods[0]!.id;
  checkIn('one', periodId, descriptor, classTime);
  // Recreate the legacy state after adding representative attendance data.
  const legacy = openDatabase(process.env.DATABASE_PATH!);
  legacy.exec('DROP TABLE attendance_demo_records; DROP TABLE attendance_demo_references; PRAGMA user_version = 2;');
  legacy.close();
  const migrated = openDatabase(process.env.DATABASE_PATH!);
  try {
    expect(migrated.prepare('PRAGMA user_version').get()).toEqual({ user_version: 3 });
    expect(migrated.prepare('SELECT count(*) AS count FROM users').get()).toEqual({ count: 2 });
    expect(migrated.prepare('SELECT recorded_at FROM attendance_records WHERE user_id = ?').get('one')).toEqual({ recorded_at: classTime.getTime() });
    expect(migrated.prepare('SELECT count(*) AS count FROM attendance_demo_references').get()).toEqual({ count: 0 });
  } finally { migrated.close(); }
});
