// Smoke script for Task 1: verify Sharp and Tesseract.js with local English asset.
// Run with: node scripts/ocr-smoke.mjs
// This file is not committed to production; it's a one-off verification script.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const langPath = path.join(root, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int');

async function main() {
  // --- Sharp: decode a synthetic PNG ---
  const svgCard = `<svg width="400" height="220" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="220" fill="white"/>
    <text x="10" y="35"  font-size="18" font-family="Arial" fill="black">Name: John Student</text>
    <text x="10" y="70"  font-size="18" font-family="Arial" fill="black">Student ID: 001234567</text>
    <text x="10" y="105" font-size="18" font-family="Arial" fill="black">Department: Computer Science</text>
    <text x="10" y="140" font-size="18" font-family="Arial" fill="black">Program: B.Tech</text>
    <text x="10" y="175" font-size="18" font-family="Arial" fill="black">Year: 2</text>
  </svg>`;

  const pngBuf = await sharp(Buffer.from(svgCard)).png().toBuffer();
  const meta = await sharp(pngBuf).metadata();
  console.log(`[Sharp] ok: format=${meta.format} ${meta.width}x${meta.height} bytes=${pngBuf.byteLength}`);

  // --- Tesseract.js: real OCR with local English asset ---
  console.log(`[Tesseract] langPath: ${langPath}`);
  const t0 = Date.now();

  const worker = await createWorker('eng', 1, {
    langPath,
    gzip: true,
    cacheMethod: 'none',   // never read/write cache dir — use langPath directly
    logger: () => {},       // suppress progress noise
  });

  const { data: { text } } = await worker.recognize(pngBuf);
  await worker.terminate();

  const ms = Date.now() - t0;
  console.log(`[Tesseract] ok: latency=${ms}ms`);
  console.log('[Tesseract] raw OCR text:');
  console.log('---');
  console.log(text.trim());
  console.log('---');

  // Minimal assertions
  const hasName = /Name/i.test(text);
  const hasId   = /Student\s*ID|001234567/i.test(text);
  console.log(`[Assert] Name field found: ${hasName}`);
  console.log(`[Assert] Student ID found: ${hasId}`);

  if (!hasName || !hasId) {
    console.error('[FAIL] OCR did not return expected labeled fields.');
    process.exit(1);
  }
  console.log('[PASS] All checks passed.');
}

main().catch(e => { console.error('[FAIL]', e.message); process.exit(1); });
