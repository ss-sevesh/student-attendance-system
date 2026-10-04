import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const password = 'password-horse-battery';

const SYNTHETIC_CARD_SVG = `<svg width="600" height="320" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="320" fill="#ffffff"/>
  <text x="30" y="50"  font-size="22" font-weight="bold" font-family="Arial" fill="#000000">STATE INSTITUTE OF TECHNOLOGY</text>
  <text x="30" y="95"  font-size="20" font-family="Arial" fill="#000000">Name: Jane Example</text>
  <text x="30" y="135" font-size="20" font-family="Arial" fill="#000000">Student ID: 001234567</text>
  <text x="30" y="175" font-size="20" font-family="Arial" fill="#000000">Department: Computer Science</text>
  <text x="30" y="215" font-size="20" font-family="Arial" fill="#000000">Program: B.Tech</text>
  <text x="30" y="255" font-size="20" font-family="Arial" fill="#000000">Year: 2</text>
  <text x="30" y="295" font-size="20" font-family="Arial" fill="#000000">Blood Group: O+</text>
</svg>`;

async function createSyntheticPngBuffer(): Promise<Buffer> {
  return sharp(Buffer.from(SYNTHETIC_CARD_SVG)).png().toBuffer();
}

async function createBlankPngBuffer(): Promise<Buffer> {
  return sharp({
    create: {
      width: 200,
      height: 100,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();
}

test('unauthenticated users are redirected from /register to /login', async ({ page }) => {
  await page.goto('/register');
  await expect(page).toHaveURL(/\/login$/);
});

test('authenticated student can navigate to /register, preview, extract ID card, review raw text, and replace/retry', async ({
  page,
}) => {
  const email = `student-ocr-${randomUUID()}@example.com`;

  // 1. Sign up and navigate to dashboard
  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // 2. Click active Register Student link
  const registerLink = page.getByRole('link', { name: 'Register Student' });
  await expect(registerLink).toBeVisible();
  await registerLink.click();
  await expect(page).toHaveURL(/\/register$/);

  // Verify page structure
  await expect(page.getByRole('heading', { name: 'ID Card Extraction' })).toBeVisible();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  // 3. Inspect upload section
  const fileInput = page.locator('#id-card-input');
  await expect(fileInput).toBeVisible();

  const extractButton = page.getByRole('button', { name: 'Extract Details' });
  await expect(extractButton).toBeDisabled();

  // 4. Select synthetic card image
  const pngBuffer = await createSyntheticPngBuffer();
  await fileInput.setInputFiles({
    name: 'synthetic-card.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });

  // Verify preview appears
  await expect(page.getByAltText('Selected student ID card preview')).toBeVisible();
  await expect(page.getByText(/synthetic-card\.png/)).toBeVisible();
  await expect(extractButton).toBeEnabled();

  // 5. Test Replace Image button
  const replaceButton = page.getByRole('button', { name: 'Replace Image' });
  await expect(replaceButton).toBeVisible();
  await replaceButton.click();

  // Preview should be gone and extract button disabled again
  await expect(page.getByAltText('Selected student ID card preview')).not.toBeVisible();
  await expect(extractButton).toBeDisabled();

  // 6. Select image again and extract
  await fileInput.setInputFiles({
    name: 'synthetic-card.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });
  await fileInput.focus();
  await page.keyboard.press('Tab');
  await expect(extractButton).toBeFocused();
  await page.keyboard.press('Enter');

  // 7. Verify results section
  await expect(page.getByRole('heading', { name: 'Extraction Review' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Temporary candidate data/)).toBeVisible();

  // Verify candidate fields
  const fieldsCard = page.locator('.extracted-fields-card');
  await expect(fieldsCard.getByText('Jane Example')).toBeVisible();
  await expect(fieldsCard.getByText('001234567')).toBeVisible(); // Leading zeros!
  await expect(fieldsCard.getByText('Computer Science')).toBeVisible();

  // Verify additional label
  const additionalCard = page.locator('.additional-fields-card');
  await expect(additionalCard.getByText('Blood Group')).toBeVisible();
  await expect(additionalCard.getByText('O+')).toBeVisible();

  // Verify raw OCR text is displayed in preformatted block
  const rawTextPre = page.locator('.raw-text-content');
  await expect(rawTextPre).toBeVisible();
  await expect(rawTextPre).toContainText('Jane Example');
  await expect(rawTextPre).toContainText('001234567');

  // Verify no horizontal overflow
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  // 8. Test retry / upload different card
  const uploadDifferentBtn = page.getByRole('button', { name: 'Upload a different card' });
  await expect(uploadDifferentBtn).toBeVisible();
  await uploadDifferentBtn.click();

  // Form should be reset
  await expect(page.getByRole('heading', { name: 'Extraction Review' })).not.toBeVisible();
});

test('blank image displays actionable error and allows retry', async ({ page }) => {
  const email = `student-blank-${randomUUID()}@example.com`;

  // Sign up
  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/register');

  const fileInput = page.locator('#id-card-input');
  const blankBuffer = await createBlankPngBuffer();

  await fileInput.setInputFiles({
    name: 'blank-card.png',
    mimeType: 'image/png',
    buffer: blankBuffer,
  });

  const extractButton = page.getByRole('button', { name: 'Extract Details' });
  await extractButton.click();

  // Alert banner should appear with actionable error
  const alert = page.locator('.form-error-banner');
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toContainText(/No text could be extracted|could not be read/i);

  // Retry button
  const retryBtn = page.getByRole('button', { name: 'Try Another Image' });
  await expect(retryBtn).toBeVisible();
  await retryBtn.click();

  await expect(alert).not.toBeVisible();
});

test('invalid files are rejected and a corrupt image can be replaced', async ({ page }) => {
  const email = `student-invalid-${randomUUID()}@example.com`;
  await page.goto('/signup');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/register');

  const fileInput = page.locator('#id-card-input');
  const alert = page.locator('.form-error-banner');
  const extractButton = page.getByRole('button', { name: 'Extract Details' });

  await fileInput.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(alert).toContainText('Unsupported file format');
  await expect(extractButton).toBeDisabled();

  await fileInput.setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(alert).toContainText('exceeds the 10 MB limit');
  await expect(extractButton).toBeDisabled();

  await fileInput.setInputFiles({ name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from('fake PNG bytes') });
  await extractButton.click();
  await expect(alert).toContainText(/corrupt|supported/i);
  await expect(page.getByRole('heading', { name: 'Extraction Review' })).toBeVisible();
  await page.getByRole('button', { name: 'Try Another Image' }).click();
  await expect(alert).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Extraction Review' })).not.toBeVisible();
});
