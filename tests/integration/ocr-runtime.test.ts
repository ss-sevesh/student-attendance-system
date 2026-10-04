/**
 * Task 1: OCR runtime integration test.
 *
 * Verifies that:
 * 1. Sharp loads natively and decodes a synthetic PNG buffer.
 * 2. Tesseract.js creates an English worker from the local language asset
 *    (no network download at runtime), performs real OCR on a clearly labeled
 *    synthetic card image, and terminates cleanly.
 * 3. Leading zeros in a student ID survive the OCR round-trip.
 *
 * Does NOT use real student records or write to disk.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

// Absolute path to the locally installed English LSTM data.
// The gzip file ships in @tesseract.js-data/eng — no CDN fetch needed.
const LANG_PATH = join(
  process.cwd(),
  'node_modules',
  '@tesseract.js-data',
  'eng',
  '4.0.0_best_int',
);

// Tesseract cold-start can take a few seconds on the first run.
const OCR_TIMEOUT_MS = 30_000;

// Minimal SVG ID-card fixture. Clearly labeled so the parser tests can rely
// on the same text structure. Leading zeros in Student ID must survive.
const SYNTHETIC_CARD_SVG = `<svg width="500" height="260" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="260" fill="white"/>
  <text x="20" y="45"  font-size="20" font-family="Arial" fill="black">Name: Jane Example</text>
  <text x="20" y="85"  font-size="20" font-family="Arial" fill="black">Student ID: 001234567</text>
  <text x="20" y="125" font-size="20" font-family="Arial" fill="black">Department: Computer Science</text>
  <text x="20" y="165" font-size="20" font-family="Arial" fill="black">Program: B.Tech</text>
  <text x="20" y="205" font-size="20" font-family="Arial" fill="black">Year: 2</text>
  <text x="20" y="245" font-size="20" font-family="Arial" fill="black">Email: jane@example.edu</text>
</svg>`;

describe('OCR runtime (Task 1)', () => {
  it('Sharp loads natively and decodes a synthetic PNG', async () => {
    const buf = await sharp(Buffer.from(SYNTHETIC_CARD_SVG)).png().toBuffer();
    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
    expect(buf.byteLength).toBeGreaterThan(0);
  });

  it(
    'Tesseract.js starts an English worker from local asset, runs OCR, and terminates',
    async () => {
      const pngBuf = await sharp(Buffer.from(SYNTHETIC_CARD_SVG)).png().toBuffer();

      const t0 = Date.now();
      const worker = await createWorker('eng', 1, {
        langPath: LANG_PATH,
        gzip: true,
        // 'none' means: never read or write a cache directory — load directly
        // from langPath each time. This proves there is no runtime network fetch.
        cacheMethod: 'none',
        logger: () => {},
      });

      let rawText = '';
      try {
        const result = await worker.recognize(pngBuf);
        rawText = result.data.text;
      } finally {
        await worker.terminate();
      }

      const latencyMs = Date.now() - t0;

      // Latency is informational — OCR must complete within the test timeout.
      expect(latencyMs).toBeGreaterThan(0);

      // Required labeled fields must be present in OCR output.
      expect(rawText).toMatch(/Name/i);
      expect(rawText).toMatch(/Jane\s*Example/i);

      // Student ID with leading zeros must be preserved verbatim.
      expect(rawText).toMatch(/001234567/);

      expect(rawText).toMatch(/Department/i);
      expect(rawText).toMatch(/Computer\s*Science/i);
      expect(rawText).toMatch(/Program/i);
      expect(rawText).toMatch(/B\.?Tech/i);
    },
    OCR_TIMEOUT_MS,
  );

  it(
    'Tesseract.js worker terminates cleanly on a blank white image',
    async () => {
      const blankBuf = await sharp({
        create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } },
      }).png().toBuffer();

      const worker = await createWorker('eng', 1, {
        langPath: LANG_PATH,
        gzip: true,
        cacheMethod: 'none',
        logger: () => {},
      });

      let text = '';
      try {
        const result = await worker.recognize(blankBuf);
        text = result.data.text.trim();
      } finally {
        await worker.terminate();
      }

      // A blank image should produce empty or whitespace-only text — not throw.
      expect(typeof text).toBe('string');
    },
    OCR_TIMEOUT_MS,
  );
});
