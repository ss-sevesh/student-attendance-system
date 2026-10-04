import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

const password = 'password-horse-battery';

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.error) console.error(testInfo.error.message, 'URL:', page.url(), 'ALERT:', await page.locator('.form-error').allInnerTexts());
});

async function signUp(page: Page) {
  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Email address' }).fill(`attendance-flow-${randomUUID()}@example.com`);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/attendance');
  await expect(page.getByRole('heading', { name: 'Face enrollment' })).toBeVisible();
}

async function installSyntheticFaceFixture(page: Page) {
  await page.addInitScript(() => {
    const state = { faceCount: 1, denyCamera: false, cameraTracksStopped: false };
    Object.assign(window, { attendanceTestFixture: state });
    const net = { loadFromUri: async () => {} };
    Object.assign(window, {
      faceapi: {
        nets: { tinyFaceDetector: net, faceLandmark68Net: net, faceRecognitionNet: net },
        TinyFaceDetectorOptions: class {},
        detectAllFaces: () => ({ withFaceLandmarks: () => ({ withFaceDescriptors: async () => Array.from(
          { length: state.faceCount }, () => ({ descriptor: new Float32Array(128) }),
        ) }) }),
      },
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          if (state.denyCamera) throw new DOMException('Permission denied', 'NotAllowedError');
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 160;
          canvas.getContext('2d')!.fillRect(0, 0, 160, 160);
          const stream = canvas.captureStream(30);
          stream.getTracks().forEach((track) => {
            const stop = track.stop.bind(track);
            track.stop = () => { state.cameraTracksStopped = true; stop(); };
          });
          return stream;
        },
      },
    });
  });
}

async function selectCard(page: Page) {
  const image = await sharp({ create: { width: 160, height: 160, channels: 3, background: '#eee' } }).png().toBuffer();
  await page.getByLabel('ID card image').setInputFiles({ name: 'synthetic-card.png', mimeType: 'image/png', buffer: image });
}

test('explicit enrollment, replacement, and deletion persist for the signed-in student with a synthetic face fixture', async ({ page }) => {
  await installSyntheticFaceFixture(page);
  await signUp(page);
  const enroll = page.getByRole('button', { name: 'Enroll face from card' });
  await selectCard(page);
  await expect(enroll).toBeDisabled();
  await page.getByRole('checkbox', { name: /I agree to store an encrypted face reference/ }).check();
  await enroll.click();
  await expect(page.getByRole('status')).toContainText('Face reference enrolled');
  await expect(page.getByRole('button', { name: 'Remove face reference' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /I agree to store an encrypted face reference/ })).not.toBeChecked();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Replace face reference' })).toBeVisible();
  await selectCard(page);
  await page.getByRole('checkbox', { name: /I agree to store an encrypted face reference/ }).check();
  await page.getByRole('button', { name: 'Replace face reference' }).click();
  await expect(page.getByRole('status')).toContainText('Face reference replaced');
  await page.getByRole('button', { name: 'Remove face reference' }).click();
  await expect(page.getByRole('status')).toContainText('Face reference removed');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Enroll face from card' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unsupported and zero/multiple-face card fixtures never enroll', async ({ page }) => {
  await installSyntheticFaceFixture(page);
  await signUp(page);
  await page.getByLabel('ID card image').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(page.locator('.form-error')).toContainText('Choose a JPEG, PNG, or WebP');
  await selectCard(page);
  await page.getByRole('checkbox', { name: /I agree to store an encrypted face reference/ }).check();
  await page.evaluate(() => { (window as unknown as { attendanceTestFixture: { faceCount: number } }).attendanceTestFixture.faceCount = 0; });
  await page.getByRole('button', { name: 'Enroll face from card' }).click();
  await expect(page.locator('.form-error')).toContainText('No face found');
  await page.evaluate(() => { (window as unknown as { attendanceTestFixture: { faceCount: number } }).attendanceTestFixture.faceCount = 2; });
  await page.getByRole('button', { name: 'Enroll face from card' }).click();
  await expect(page.locator('.form-error')).toContainText('More than one face found');
  await expect(page.getByRole('button', { name: 'Remove face reference' })).toHaveCount(0);
});

test('camera preview and two period decisions use fixture responses, with no real face-model claim', async ({ page }) => {
  await installSyntheticFaceFixture(page);
  await signUp(page);
  const periods = [
    { id: 101, name: 'First period', start_time: '09:00', open: true, recordedAt: null as number | null },
    { id: 102, name: 'Second period', start_time: '09:45', open: true, recordedAt: null as number | null },
  ];
  await page.route('**/api/attendance/status', async (route) => route.fulfill({ json: { date: '2026-10-05', timezone: 'Asia/Kolkata', enrolled: true, periods } }));
  let submissions = 0;
  await page.route('**/api/attendance/check-in', async (route) => {
    const { periodId } = route.request().postDataJSON() as { periodId: number };
    submissions += 1;
    periods.find((period) => period.id === periodId)!.recordedAt = Date.now();
    await route.fulfill({ json: { status: 'present', recordedAt: Date.now() } });
  });
  await page.reload();
  await page.evaluate(() => { (window as unknown as { attendanceTestFixture: { denyCamera: boolean } }).attendanceTestFixture.denyCamera = true; });
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.locator('.form-error')).toContainText('permission denied');
  await expect(page.getByRole('button', { name: 'Check in' }).first()).toBeDisabled();
  await page.evaluate(() => { (window as unknown as { attendanceTestFixture: { denyCamera: boolean } }).attendanceTestFixture.denyCamera = false; });
  await page.getByRole('button', { name: 'Start camera' }).click();
  await expect(page.getByLabel('Live camera preview')).toBeVisible();
  await page.getByRole('button', { name: 'Check in' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Present recorded');
  expect(await page.evaluate(() => (window as unknown as { attendanceTestFixture: { cameraTracksStopped: boolean } }).attendanceTestFixture.cameraTracksStopped)).toBe(true);
  await expect(page.getByText(/Present at/)).toHaveCount(1);
  await page.getByRole('button', { name: 'Start camera' }).click();
  await page.getByRole('button', { name: 'Check in' }).click();
  await expect(page.getByText(/Present at/)).toHaveCount(2);
  expect(submissions).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
