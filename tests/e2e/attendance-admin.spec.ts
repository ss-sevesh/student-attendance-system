import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from '@playwright/test';

const adminEmail = 'browser-admin@example.com';
const password = 'correct horse battery stable';
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

test.skip(!process.env.ADMIN_E2E_DB_PATH, 'Run with playwright.admin.config.ts for an isolated admin test database.');

test('admin timetable edits appear to students while role and record safeguards hold', async ({ page, browser, baseURL }) => {
  const origin = baseURL!;
  const adminSignup = await page.request.post('/api/auth/signup', {
    data: { email: adminEmail, password }, headers: { Origin: origin },
  });
  if (adminSignup.status() === 409) {
    const login = await page.request.post('/api/auth/login', {
      data: { email: adminEmail, password }, headers: { Origin: origin },
    });
    expect(login.ok()).toBe(true);
  } else {
    expect(adminSignup.status()).toBe(201);
  }

  const today = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(new Date());
  const firstName = `Admin first ${randomUUID().slice(0, 8)}`;
  const secondName = `Admin second ${randomUUID().slice(0, 8)}`;
  await page.goto('/admin/attendance');
  await expect(page.getByRole('heading', { name: 'Attendance timetable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weekly timetable' })).toBeVisible();

  for (const [time, name] of [['09:00', firstName], ['09:45', secondName]]) {
    await page.getByLabel('Weekday').selectOption(String(weekdays.indexOf(today)));
    await page.getByLabel('Start time').fill(time);
    await page.getByLabel('Period name').fill(name);
    await page.getByRole('button', { name: 'Add period' }).click();
    await expect(page.getByRole('status')).toHaveText('Period added.');
    await expect(page.getByText(`${today} ${time} — ${name}`)).toBeVisible();
  }

  const timetable = await page.request.get('/api/attendance/periods');
  expect(timetable.ok()).toBe(true);
  const periods = (await timetable.json()).periods as { id: number; name: string }[];
  const firstId = periods.find((period) => period.name === firstName)?.id;
  expect(firstId).toBeDefined();

  const student = await browser.newContext();
  try {
    const studentPage = await student.newPage();
    const studentEmail = `admin-check-${randomUUID()}@example.com`;
    const signup = await studentPage.request.post(`${origin}/api/auth/signup`, {
      data: { email: studentEmail, password }, headers: { Origin: origin },
    });
    expect(signup.status()).toBe(201);
    const deniedPage = await studentPage.goto(`${origin}/admin/attendance`);
    expect(deniedPage?.status()).toBe(404);
    await expect(studentPage.getByRole('heading', { name: 'Attendance timetable' })).toHaveCount(0);
    expect((await studentPage.request.get(`${origin}/api/attendance/periods`)).status()).toBe(403);
    expect((await studentPage.request.post(`${origin}/api/attendance/periods`, {
      data: { weekday: weekdays.indexOf(today), startTime: '10:00', name: 'Unauthorized' }, headers: { Origin: origin },
    })).status()).toBe(403);
    expect((await studentPage.request.delete(`${origin}/api/attendance/periods`, {
      data: { id: firstId }, headers: { Origin: origin },
    })).status()).toBe(403);
    expect((await studentPage.request.put(`${origin}/api/attendance/periods`, {
      data: { weekday: 0, periods: [] }, headers: { Origin: origin },
    })).status()).toBe(403);

    await studentPage.goto(`${origin}/attendance`);
    await expect(studentPage.getByText(firstName)).toBeVisible();
    await expect(studentPage.getByText(secondName)).toBeVisible();
    await expect(studentPage.getByText('09:00–09:05').first()).toBeVisible();
    await expect(studentPage.getByText('09:45–09:50').first()).toBeVisible();
    expect(await studentPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const status = await studentPage.request.get(`${origin}/api/attendance/status`);
    expect(status.ok()).toBe(true);
    const localDate = (await status.json()).date as string;
    const db = new DatabaseSync(process.env.ADMIN_E2E_DB_PATH!);
    try {
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(studentEmail) as { id: string };
      db.prepare('INSERT INTO attendance_records (user_id, period_id, local_date, recorded_at, distance) VALUES (?, ?, ?, ?, ?)')
        .run(user.id, firstId!, localDate, Date.now(), 0.1);
    } finally { db.close(); }

    await page.getByRole('button', { name: `Remove ${firstName} on ${today} at 09:00` }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'cannot be removed' })).toBeVisible();
    await expect(page.getByText(`${today} 09:00 — ${firstName}`)).toBeVisible();
    const retained = new DatabaseSync(process.env.ADMIN_E2E_DB_PATH!);
    try {
      expect(retained.prepare('SELECT count(*) AS count FROM attendance_records WHERE period_id = ?').get(firstId!))
        .toEqual({ count: 1 });
    } finally { retained.close(); }

    await page.getByRole('button', { name: `Remove ${secondName} on ${today} at 09:45` }).click();
    await expect(page.getByRole('status')).toHaveText('Period removed.');
    await expect(page.getByText(`${today} 09:45 — ${secondName}`)).toHaveCount(0);
    await studentPage.reload();
    await expect(studentPage.getByText(firstName)).toBeVisible();
    await expect(studentPage.getByText(secondName)).toHaveCount(0);
  } finally {
    await student.close();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Enter timetable manually' }).click();
  await page.getByLabel('Timetable weekday').selectOption('0');
  await page.getByLabel('Period 1 name', { exact: true }).fill('Manual Mathematics');
  await page.getByLabel('Period 1 start time', { exact: true }).fill('08:30');
  await page.getByRole('button', { name: 'Save seven periods' }).click();
  await expect(page.getByRole('status')).toContainText('Seven periods saved for Sunday');
  await page.reload();
  await page.getByRole('button', { name: 'Enter timetable manually' }).click();
  await page.getByLabel('Timetable weekday').selectOption('0');
  await expect(page.getByLabel('Period 1 name', { exact: true })).toHaveValue('Manual Mathematics');
  await expect(page.getByLabel('Period 1 start time', { exact: true })).toHaveValue('08:30');
  await page.getByLabel('Period 1 name', { exact: true }).fill('Edited Mathematics');
  await page.getByLabel('Period 1 start time', { exact: true }).fill('08:45');
  await page.getByRole('button', { name: 'Save seven periods' }).click();
  await expect(page.getByRole('status')).toContainText('Seven periods saved');
  const saved = (await (await page.request.get('/api/attendance/periods')).json()).periods as { weekday: number; name: string; start_time: string }[];
  expect(saved.filter((row) => row.weekday === 0)).toHaveLength(7);
  expect(saved.find((row) => row.name === 'Edited Mathematics')?.start_time).toBe('08:45');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
