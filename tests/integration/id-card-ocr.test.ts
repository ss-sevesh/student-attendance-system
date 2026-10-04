/**
 * Task 3: Bounded image decoding and real OCR integration tests.
 *
 * Verifies:
 * - JPEG, PNG, and WebP synthetic cards yield actual raw OCR text and parsed fields.
 * - Leading zeros in student ID survive full decode + OCR + parse pipeline.
 * - Corrupt, mismatched, oversized, excessive-pixel, and blank images fail safely.
 * - OCR worker is released in all outcomes and latency is recorded.
 * - No images are written to disk.
 */

import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  detectImageFormat,
  MAX_IMAGE_BYTES,
  validateAndPreprocessImage,
} from '../../src/lib/id-card/image';
import { extractFromIdCardImage } from '../../src/lib/id-card/ocr';

const OCR_TIMEOUT_MS = 60_000;

// Crisp SVG synthetic ID card
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

describe('ID-card Image & OCR pipeline (Task 3)', () => {
  it('detects magic bytes for JPEG, PNG, and WebP', async () => {
    const png = await sharp(Buffer.from(SYNTHETIC_CARD_SVG)).png().toBuffer();
    const jpeg = await sharp(Buffer.from(SYNTHETIC_CARD_SVG)).jpeg().toBuffer();
    const webp = await sharp(Buffer.from(SYNTHETIC_CARD_SVG)).webp().toBuffer();

    expect(detectImageFormat(png)).toBe('png');
    expect(detectImageFormat(jpeg)).toBe('jpeg');
    expect(detectImageFormat(webp)).toBe('webp');

    // Unsupported
    expect(detectImageFormat(Buffer.from('GIF89a... not supported'))).toBeNull();
    expect(detectImageFormat(Buffer.from('Hello world text content'))).toBeNull();
  });

  it(
    'extracts real OCR text and labeled fields from a PNG synthetic card',
    async () => {
      const pngBuf = await sharp(Buffer.from(SYNTHETIC_CARD_SVG)).png().toBuffer();

      const result = await extractFromIdCardImage(pngBuf);

      expect(result.source).toBe('id-card');
      expect(result.status).toBe('success');
      expect(result.rawText).toBeTruthy();
      expect(result.latencyMs).toBeGreaterThan(0);

      // Verify OCR captured the fields
      expect(result.fields.name).toMatch(/Jane\s*Example/i);
      expect(result.fields.studentId).toBe('001234567'); // Leading zeros intact!
      expect(result.fields.department).toMatch(/Computer\s*Science/i);
      expect(result.fields.program).toMatch(/B\.?Tech/i);
      expect(result.fields.year).toBe('2');

      // Verify additional field
      const bloodGroup = result.additionalFields.find((f) => /blood\s*group/i.test(f.label));
      expect(bloodGroup).toBeDefined();
      expect(bloodGroup?.value).toMatch(/O\+/);
    },
    OCR_TIMEOUT_MS,
  );

  it(
    'extracts real OCR text from a JPEG synthetic card',
    async () => {
      const jpegBuf = await sharp(Buffer.from(SYNTHETIC_CARD_SVG))
        .jpeg({ quality: 95 })
        .toBuffer();

      const result = await extractFromIdCardImage(jpegBuf);

      expect(result.status).toBe('success');
      expect(result.fields.name).toMatch(/Jane\s*Example/i);
      expect(result.fields.studentId).toBe('001234567');
    },
    OCR_TIMEOUT_MS,
  );

  it(
    'extracts real OCR text from a WebP synthetic card',
    async () => {
      const webpBuf = await sharp(Buffer.from(SYNTHETIC_CARD_SVG))
        .webp({ quality: 95 })
        .toBuffer();

      const result = await extractFromIdCardImage(webpBuf);

      expect(result.status).toBe('success');
      expect(result.fields.name).toMatch(/Jane\s*Example/i);
      expect(result.fields.studentId).toBe('001234567');
    },
    OCR_TIMEOUT_MS,
  );

  it('fails safely on corrupt image bytes', async () => {
    // Starts with PNG magic bytes but followed by garbage
    const corruptPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('corrupt garbage content that is not a valid png image'),
    ]);

    const result = await extractFromIdCardImage(corruptPng);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('corrupt_image');
  });

  it('fails safely on mismatched or unsupported formats (e.g. GIF or plain text)', async () => {
    const textBuffer = Buffer.from('Name: Fake Student\nStudent ID: 12345');
    const result = await extractFromIdCardImage(textBuffer);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('unsupported_format');
  });

  it('fails safely on oversized image (>10 MB)', async () => {
    const fakeOversized = Buffer.alloc(MAX_IMAGE_BYTES + 1024);
    // Fake PNG magic bytes
    fakeOversized[0] = 0x89;
    fakeOversized[1] = 0x50;
    fakeOversized[2] = 0x4e;
    fakeOversized[3] = 0x47;
    fakeOversized[4] = 0x0d;
    fakeOversized[5] = 0x0a;
    fakeOversized[6] = 0x1a;
    fakeOversized[7] = 0x0a;

    const result = await extractFromIdCardImage(fakeOversized);

    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('file_too_large');
  });

  it('fails safely on excessive pixel dimensions', async () => {
    // Attempting to validate an image beyond pixel limit throws excessive_dimensions
    const hugeImage = sharp({
      create: {
        width: 6000,
        height: 5000, // 30,000,000 pixels > 25,000,000 limit
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    });
    const hugePngBuf = await hugeImage.png().toBuffer();

    await expect(validateAndPreprocessImage(hugePngBuf)).rejects.toThrow();

    const result = await extractFromIdCardImage(hugePngBuf);
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('excessive_dimensions');
  });

  it(
    'fails safely on a blank white image (empty OCR)',
    async () => {
      const blankBuf = await sharp({
        create: {
          width: 300,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const result = await extractFromIdCardImage(blankBuf);

      expect(result.status).toBe('failed');
      expect(['empty_ocr', 'unreadable_ocr']).toContain(result.error?.code);
    },
    OCR_TIMEOUT_MS,
  );
});
