import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const portrait = join(process.cwd(), 'tests', 'fixtures', 'obama-portrait.jpg');
const blank = join(process.cwd(), 'tests', 'fixtures', 'blank.png');
const portraitDataUrl = `data:image/jpeg;base64,${readFileSync(portrait).toString('base64')}`;

test('actual face models reject a blank card and enroll one photographic face', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Email address' }).fill(`real-model-${randomUUID()}@example.com`);
  await page.getByRole('textbox', { name: 'Password' }).fill('password-horse-battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/attendance');

  const modelResponses: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/face-api/')) {
      expect(response.status(), response.url()).toBe(200);
      modelResponses.push(new URL(response.url()).pathname);
    }
  });
  const descriptors: number[][] = [];
  await page.route('**/api/attendance/enroll', async (route) => {
    if (route.request().method() === 'POST') {
      descriptors.push((route.request().postDataJSON() as { descriptor: number[] }).descriptor);
    }
    await route.continue();
  });

  await page.getByLabel('ID card image').setInputFiles(blank);
  await page.getByRole('checkbox', { name: /I agree to store an encrypted face reference/ }).check();
  await page.getByRole('button', { name: 'Enroll face from card' }).click();
  await expect(page.locator('.form-error')).toContainText('No face found');
  expect(descriptors).toHaveLength(0);

  await page.getByLabel('ID card image').setInputFiles(portrait);
  await page.getByRole('button', { name: 'Enroll face from card' }).click();
  await expect(page.getByRole('status')).toContainText('Face reference enrolled');
  expect(descriptors).toHaveLength(1);
  expect(descriptors[0]).toHaveLength(128);
  expect(descriptors[0].every(Number.isFinite)).toBe(true);
  expect(modelResponses).toEqual(expect.arrayContaining([
    '/face-api/face-api.min.js',
    '/face-api/weights/tiny_face_detector_model-weights_manifest.json',
    '/face-api/weights/face_landmark_68_model-weights_manifest.json',
    '/face-api/weights/face_recognition_model-weights_manifest.json',
  ]));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('actual model describes a photographic video stream for check-in', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript((dataUrl) => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        ...original,
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
  await page.getByRole('textbox', { name: 'Email address' }).fill(`real-video-${randomUUID()}@example.com`);
  await page.getByRole('textbox', { name: 'Password' }).fill('password-horse-battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/attendance');

  let enrolledDescriptor: number[] = [];
  await page.route('**/api/attendance/enroll', async (route) => {
    if (route.request().method() === 'POST') {
      enrolledDescriptor = (route.request().postDataJSON() as { descriptor: number[] }).descriptor;
    }
    await route.continue();
  });
  await page.getByLabel('ID card image').setInputFiles(portrait);
  await page.getByRole('checkbox', { name: /I agree to store an encrypted face reference/ }).check();
  await page.getByRole('button', { name: 'Enroll face from card' }).click();
  await expect(page.getByRole('status')).toContainText('Face reference enrolled');

  await page.route('**/api/attendance/status', (route) => route.fulfill({ json: {
    date: '2026-10-04', timezone: 'Asia/Kolkata', enrolled: true,
    periods: [{ id: 1, name: 'Model video check', start_time: '09:00', open: true, recordedAt: null }],
  } }));
  let videoDescriptor: number[] = [];
  await page.route('**/api/attendance/check-in', async (route) => {
    videoDescriptor = (route.request().postDataJSON() as { descriptor: number[] }).descriptor;
    await route.fulfill({ json: { status: 'present', recordedAt: Date.now() } });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.getByRole('button', { name: 'Check in' })).toBeEnabled();
  await page.getByRole('button', { name: 'Check in' }).click();
  await expect(page.getByRole('status')).toContainText('Present recorded');
  expect(videoDescriptor).toHaveLength(128);
  const distance = Math.hypot(...videoDescriptor.map((value, index) => value - enrolledDescriptor[index]));
  expect(distance).toBeLessThan(0.45);
});
