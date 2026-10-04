import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

const password = 'password-horse-battery';

test('attendance page requires sign-in and explains the demo limits', async ({ page }) => {
  await page.goto('/attendance');
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Email address' }).fill(`attendance-${randomUUID()}@example.com`);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('link', { name: 'Open attendance' }).click();
  await expect(page.getByRole('heading', { name: 'Period check-in' })).toBeVisible();
  await expect(page.getByText(/can be fooled by a photo/)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /I agree to store an encrypted face reference/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
