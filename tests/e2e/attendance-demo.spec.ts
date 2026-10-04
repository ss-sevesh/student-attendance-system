import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const portrait = join(process.cwd(), 'tests', 'fixtures', 'obama-portrait.jpg');
const portraitDataUrl = `data:image/jpeg;base64,${readFileSync(portrait).toString('base64')}`;

test('demo saves a reference, matches a photographic camera stream, and persists only a demo result', async ({ page }) => {
  test.setTimeout(90_000);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  // This verifies the real model and API with a repeatable video source, not physical camera hardware or liveness.
  await page.addInitScript((dataUrl) => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const image = new Image();
          image.src = dataUrl;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          canvas.getContext('2d')!.drawImage(image, 0, 0);
          return canvas.captureStream(15);
        },
      },
    });
  }, portraitDataUrl);
  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Email address' }).fill(`demo-${randomUUID()}@example.com`);
  await page.getByRole('textbox', { name: 'Password' }).fill('password-horse-battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/attendance/demo');

  await page.getByLabel('Reference selfie', { exact: true }).setInputFiles(portrait);
  await page.getByRole('checkbox', { name: 'I agree to save my face reference for this demo.' }).check();
  await page.getByRole('button', { name: 'Save demo reference' }).click();
  await expect(page.getByRole('button', { name: 'Remove demo reference' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.getByRole('button', { name: 'Mark demo attendance' })).toBeEnabled();
  const checkInResponse = page.waitForResponse((response) => {
    if (!response.url().endsWith('/api/attendance/demo') || response.request().method() !== 'POST') return false;
    return response.request().postDataJSON().action === 'check-in';
  });
  await page.getByRole('button', { name: 'Mark demo attendance' }).click();
  const result = await checkInResponse;
  expect(result.status()).toBe(200);
  expect(await result.json()).toMatchObject({ status: 'present', recordedAt: expect.any(Number) });
  await expect(page.getByText(/Last demo Present/)).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByText(/Last demo Present/)).toBeVisible();
  const scheduled = await page.request.get('/api/attendance/status');
  expect(scheduled.ok()).toBe(true);
  expect(await scheduled.json()).toMatchObject({ enrolled: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('demo-present.png'), fullPage: true });

  await page.getByRole('button', { name: 'Reset demo result' }).click();
  await expect(page.getByText(/Last demo Present/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Last demo Present/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start camera' })).toBeEnabled();
  await page.getByRole('button', { name: 'Remove demo reference' }).click();
  await expect(page.getByRole('button', { name: 'Remove demo reference' })).toHaveCount(0);
  const finalStatus = await page.request.get('/api/attendance/demo');
  expect(await finalStatus.json()).toEqual({ enrolled: false, recordedAt: null });
  expect(browserErrors).toEqual([]);
});
