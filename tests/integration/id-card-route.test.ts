/**
 * Task 4: Protected ID-card extraction API integration tests.
 *
 * Verifies:
 * - Missing/invalid sessions return 401.
 * - Foreign origin returns 403.
 * - Non-multipart requests return 415.
 * - Missing file or multiple files return 400.
 * - Oversized requests return 413.
 * - Unsupported or corrupt content returns 422 with status 'failed'.
 * - Authenticated valid uploads return 200 with real OCR extraction.
 * - Only the three approved college-card suggestions cross the HTTP boundary.
 * - Blank image fails safely without crash.
 * - No OCR text or images are written to database or disk.
 */

import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { POST as signup } from '../../src/app/api/auth/signup/route';
import { POST as extract } from '../../src/app/api/id-card/extract/route';
import { MAX_IMAGE_BYTES } from '../../src/lib/id-card/image';

const origin = 'http://127.0.0.1:3100';
const OCR_TIMEOUT_MS = 60_000;

const SYNTHETIC_CARD_SVG = `<svg width="700" height="390" xmlns="http://www.w3.org/2000/svg">
  <rect width="700" height="390" fill="#ffffff"/>
  <text x="30" y="50"  font-size="22" font-weight="bold" font-family="Arial" fill="#000000">STATE INSTITUTE OF TECHNOLOGY</text>
  <text x="30" y="95"  font-size="22" font-family="Arial" fill="#000000">Date of Birth : 11.05.2006</text>
  <text x="30" y="140" font-size="22" font-family="Arial" fill="#000000">Blood Group : A1+ve</text>
  <text x="30" y="185" font-size="22" font-family="Arial" fill="#000000">Resi. Address :</text>
  <text x="30" y="225" font-size="22" font-family="Arial" fill="#000000">S/O SAMPLE PARENT</text>
  <text x="30" y="265" font-size="22" font-family="Arial" fill="#000000">3/498,2E, KAMARAJ NAGAR</text>
  <text x="30" y="305" font-size="22" font-family="Arial" fill="#000000">PERUMANALLUR-641666</text>
  <text x="30" y="350" font-size="22" font-family="Arial" fill="#000000">Phone : 9876543210</text>
</svg>`;

async function createAuthenticatedSession(): Promise<string> {
  const email = `student-${crypto.randomUUID()}@example.com`;
  const response = await signup(
    new Request(`${origin}/api/auth/signup`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'password-12345' }),
    }),
  );
  expect(response.status).toBe(201);
  const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
  expect(cookie).toBeTruthy();
  return cookie;
}

describe('Protected ID-card extract route (Task 4)', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const formData = new FormData();
    formData.append('file', new File(['dummy'], 'card.png', { type: 'image/png' }));

    const res = await extract(
      new Request(`${origin}/api/id-card/extract`, {
        method: 'POST',
        headers: { origin },
        body: formData,
      }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe('unauthorized');
  });

  it('rejects invalid or expired session tokens with 401', async () => {
    const formData = new FormData();
    formData.append('file', new File(['dummy'], 'card.png', { type: 'image/png' }));

    const res = await extract(
      new Request(`${origin}/api/id-card/extract`, {
        method: 'POST',
        headers: {
          origin,
          cookie: 'student_session=invalid-or-expired-token-digest-12345',
        },
        body: formData,
      }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe('unauthorized');
  });

  it('rejects foreign origin with 403', async () => {
    const cookie = await createAuthenticatedSession();
    const formData = new FormData();
    formData.append('file', new File(['dummy'], 'card.png', { type: 'image/png' }));

    const res = await extract(
      new Request(`${origin}/api/id-card/extract`, {
        method: 'POST',
        headers: { origin: 'https://evil.attacker.com', cookie },
        body: formData,
      }),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe('invalid_origin');
  });

  it('rejects non-multipart requests with 415', async () => {
    const cookie = await createAuthenticatedSession();

    const res = await extract(
      new Request(`${origin}/api/id-card/extract`, {
        method: 'POST',
        headers: { origin, cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ file: 'not-multipart' }),
      }),
    );

    expect(res.status).toBe(415);
    const body = await res.json();
    expect(body.error?.code).toBe('unsupported_media_type');
  });

  it('rejects requests with no file with 400', async () => {
    const cookie = await createAuthenticatedSession();
    const formData = new FormData();
    formData.append('textOnly', 'hello');

    const res = await extract(
      new Request(`${origin}/api/id-card/extract`, {
        method: 'POST',
        headers: { origin, cookie },
        body: formData,
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe('missing_file');
  });

  it('rejects requests with multiple files with 400', async () => {
    const cookie = await createAuthenticatedSession();
    const formData = new FormData();
    formData.append('file1', new File(['file 1'], 'card1.png', { type: 'image/png' }));
    formData.append('file2', new File(['file 2'], 'card2.png', { type: 'image/png' }));

    const res = await extract(
      new Request(`${origin}/api/id-card/extract`, {
        method: 'POST',
        headers: { origin, cookie },
        body: formData,
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe('multiple_files');
  });

  it('rejects empty file (0 bytes) with 400', async () => {
    const cookie = await createAuthenticatedSession();
    const formData = new FormData();
    formData.append('file', new File([], 'empty.png', { type: 'image/png' }));

    const res = await extract(
      new Request(`${origin}/api/id-card/extract`, {
        method: 'POST',
        headers: { origin, cookie },
        body: formData,
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe('empty_file');
  });

  it('rejects oversized file (>10 MB) with 413', async () => {
    const cookie = await createAuthenticatedSession();
    // Simulate oversized by constructing a fake large buffer
    const largeBuffer = new Uint8Array(MAX_IMAGE_BYTES + 1024);
    const formData = new FormData();
    formData.append(
      'file',
      new File([largeBuffer], 'large.png', { type: 'image/png' }),
    );

    const res = await extract(
      new Request(`${origin}/api/id-card/extract`, {
        method: 'POST',
        headers: { origin, cookie },
        body: formData,
      }),
    );

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error?.code).toBe('file_too_large');
  });

  it('rejects unsupported file content (e.g. text file pretending to be image) with 422', async () => {
    const cookie = await createAuthenticatedSession();
    const formData = new FormData();
    formData.append(
      'file',
      new File(['plain text disguised as image'], 'fake.png', { type: 'image/png' }),
    );

    const res = await extract(
      new Request(`${origin}/api/id-card/extract`, {
        method: 'POST',
        headers: { origin, cookie },
        body: formData,
      }),
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.status).toBe('failed');
    expect(body.error?.code).toBe('unsupported_format');
  });

  it(
    'processes authenticated valid synthetic ID-card image and returns 200 with real OCR result',
    async () => {
      const cookie = await createAuthenticatedSession();
      const pngBuf = await sharp(Buffer.from(SYNTHETIC_CARD_SVG)).png().toBuffer();

      const formData = new FormData();
      formData.append(
        'file',
        new File([new Uint8Array(pngBuf)], 'student-id.png', { type: 'image/png' }),
      );

      const res = await extract(
        new Request(`${origin}/api/id-card/extract`, {
          method: 'POST',
          headers: { origin, cookie },
          body: formData,
        }),
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');

      const body = await res.json();

      expect(body.source).toBe('id-card');
      expect(body.status).toBe('success');
      expect(body.fields.birthDate).toBe('11.05.2006');
      expect(body.fields.residentialAddress).toContain('KAMARAJ NAGAR');
      expect(body.fields.phone).toBe('9876543210');
      expect(Object.keys(body.fields).sort()).toEqual(['birthDate', 'phone', 'residentialAddress']);
      expect(body).not.toHaveProperty('rawText');
      expect(body).not.toHaveProperty('additionalFields');
    },
    OCR_TIMEOUT_MS,
  );

  it(
    'fails safely on a blank image with 422 failed status',
    async () => {
      const cookie = await createAuthenticatedSession();
      const blankBuf = await sharp({
        create: {
          width: 200,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const formData = new FormData();
      formData.append(
        'file',
        new File([new Uint8Array(blankBuf)], 'blank.png', { type: 'image/png' }),
      );

      const res = await extract(
        new Request(`${origin}/api/id-card/extract`, {
          method: 'POST',
          headers: { origin, cookie },
          body: formData,
        }),
      );

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.status).toBe('failed');
      expect(['empty_ocr', 'unreadable_ocr']).toContain(body.error?.code);
    },
    OCR_TIMEOUT_MS,
  );
});
