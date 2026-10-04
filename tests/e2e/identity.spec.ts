import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:3100';
const password = 'correct horse battery stable';

test('signup, duplicate feedback, logout, and login protect the dashboard', async ({ page }) => {
  const email = `browser-${randomUUID()}@example.com`;
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(page.getByRole('link', { name: /Register Student/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Latest reviewed profile' })).toContainText('No reviewed profile yet');

  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email.toUpperCase());
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'An account with this email already exists.' })).toBeVisible();

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('wrong password long');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Email or password is incorrect.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('invalid and expired sessions cannot open the dashboard', async ({ page, context }) => {
  await context.addCookies([{ name: 'student_session', value: 'x'.repeat(43), url: origin }]);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);

  const email = `expired-${randomUUID()}@example.com`;
  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const token = (await context.cookies()).find((cookie) => cookie.name === 'student_session')?.value;
  expect(token).toBeTruthy();
  const db = new DatabaseSync(join(tmpdir(), 'student-browser-acceptance.sqlite'));
  try {
    const digest = createHash('sha256').update(token!).digest('hex');
    expect(db.prepare('UPDATE sessions SET expires_at = 0 WHERE token_digest = ?').run(digest).changes).toBe(1);
  } finally { db.close(); }
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('form supports keyboard focus and announces a pending submission', async ({ page }) => {
  await page.goto('/signup');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Email address' }).fill(`pending-${randomUUID()}@example.com`);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.route('**/api/auth/signup', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Please wait…' })).toBeDisabled();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
