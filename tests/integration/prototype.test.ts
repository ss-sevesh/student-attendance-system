import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, it } from 'vitest';
import { prototypeCheckIn, prototypePhoto, prototypeStatus, removePrototypePhoto, resetPrototypeStudent, savePrototypePhoto } from '../../src/lib/attendance/prototype';
import { allPeriods, saveTimetableDay } from '../../src/lib/attendance/service';

const descriptor = Array(128).fill(.01) as number[];
beforeEach(() => { process.env.DATABASE_PATH = join(tmpdir(), `prototype-${randomUUID()}.sqlite`); process.env.ATTENDANCE_KEY = '01'.repeat(32); });

it('resets saved photos and all dates of attendance while preserving the timetable', () => {
  const now = new Date('2026-10-05T04:30:00Z');
  savePrototypePhoto(Buffer.from('photo'), descriptor);
  prototypeCheckIn(descriptor, now);
  prototypeCheckIn(descriptor, new Date('2026-10-06T04:30:00Z'));
  const timetable = allPeriods();
  resetPrototypeStudent();
  expect(prototypeStatus(now)).toMatchObject({ enrolled: false, photoSavedAt: null });
  expect(prototypeStatus(now).periods.every((period) => period.recordedAt === null)).toBe(true);
  expect(prototypeStatus(new Date('2026-10-06T04:30:00Z')).periods.every((period) => period.recordedAt === null)).toBe(true);
  expect(() => prototypePhoto()).toThrow('Save a photo');
  expect(allPeriods()).toEqual(timetable);
  resetPrototypeStudent();
  savePrototypePhoto(Buffer.from('new-photo'), descriptor);
  expect(prototypeCheckIn(descriptor, now).status).toBe('present');
});

it('creates a no-login prototype with seven daily periods and a persistent saved photo', () => {
  const now = new Date('2026-10-05T04:30:00Z');
  expect(prototypeStatus(now).periods).toHaveLength(7);
  const photo = Buffer.from('test-photo');
  savePrototypePhoto(photo, descriptor);
  expect(prototypeStatus(now)).toMatchObject({ enrolled: true, photoSavedAt: expect.any(Number) });
  expect(prototypePhoto()).toEqual(photo);
  removePrototypePhoto();
  expect(prototypeStatus(now)).toMatchObject({ enrolled: false, photoSavedAt: null });
  expect(() => prototypePhoto()).toThrow('Save a photo');
});

it('automatically marks period 2 at 10:00 and switches at the end boundary', () => {
  const now = new Date('2026-10-05T04:30:00Z'); // 10:00 campus time
  savePrototypePhoto(Buffer.from('photo'), descriptor);
  expect(prototypeCheckIn(descriptor, now)).toMatchObject({ status: 'present', periodName: 'Period 2' });
  expect(prototypeCheckIn(descriptor, now).status).toBe('already-recorded');
  expect(prototypeStatus(now).periods[1].recordedAt).toBe(now.getTime());
  expect(prototypeStatus(new Date('2026-10-05T05:15:00Z')).periods.find((row) => row.open)?.name).toBe('Period 3');
  expect(() => prototypeCheckIn(descriptor, new Date('2026-10-05T02:00:00Z'))).toThrow('No period');
  expect(() => prototypeCheckIn(Array(128).fill(1), new Date('2026-10-05T05:15:00Z'))).toThrow('did not match');
});

it('supports editable ranges and rejects overlaps and reversed ranges atomically', () => {
  prototypeStatus();
  const rows = allPeriods().filter((row) => row.weekday === 1).map((row) => ({ id: row.id, name: row.name, startTime: row.start_time, endTime: row.end_time }));
  expect(() => saveTimetableDay(1, rows.map((row, index) => index === 0 ? { ...row, endTime: '10:00' } : row))).toThrow('overlap');
  expect(() => saveTimetableDay(1, rows.map((row, index) => index === 0 ? { ...row, endTime: '08:00' } : row))).toThrow('later');
  saveTimetableDay(1, rows.map((row, index) => index === 1 ? { ...row, name: 'Physics', endTime: '10:30' } : row));
  const now = new Date('2026-10-05T04:30:00Z');
  expect(prototypeStatus(now).periods.find((row) => row.open)?.name).toBe('Physics');
  expect(prototypeStatus(new Date('2026-10-05T05:00:00Z')).periods.some((row) => row.open)).toBe(false);
});
