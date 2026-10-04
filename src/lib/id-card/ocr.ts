/**
 * Local English OCR runner using Tesseract.js.
 *
 * Rules:
 * - Uses the locally installed English LSTM model (@tesseract.js-data/eng).
 * - No network calls at runtime; cacheMethod: 'none'.
 * - Worker is started per request and cleanly terminated in `finally` in all outcomes.
 * - Discards image buffers after OCR; never writes to disk.
 * - Measures extraction latency.
 */

import { join } from 'node:path';
import { createWorker } from 'tesseract.js';
import {
  type ExtractionResult,
  failedResult,
  unavailableResult,
} from './types';
import { parseIdCardText } from './parse';
import { ImageValidationError, validateAndPreprocessImage } from './image';

/** Path to offline-installed English traineddata */
export const DEFAULT_LANG_PATH = join(
  process.cwd(),
  'node_modules',
  '@tesseract.js-data',
  'eng',
  '4.0.0_best_int',
);

/** Path to local node worker script */
export const DEFAULT_WORKER_PATH = join(
  process.cwd(),
  'node_modules',
  'tesseract.js',
  'src',
  'worker-script',
  'node',
  'index.js',
);

/** Path to local core wasm module */
export const DEFAULT_CORE_PATH = join(
  process.cwd(),
  'node_modules',
  'tesseract.js-core',
);

export interface OcrExecutionOptions {
  langPath?: string;
  workerPath?: string;
  corePath?: string;
  timeoutMs?: number;
}

export interface OcrOutput {
  rawText: string;
  latencyMs: number;
}

export class OcrError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

/**
 * Runs English OCR on an in-memory image buffer using a temporary worker.
 * Guarantees worker termination on success, error, or timeout.
 */
export async function recognizeText(
  imageBuffer: Buffer,
  options?: OcrExecutionOptions,
): Promise<OcrOutput> {
  const langPath = options?.langPath ?? process.env.TESSERACT_LANG_PATH ?? DEFAULT_LANG_PATH;
  const workerPath = options?.workerPath ?? process.env.TESSERACT_WORKER_PATH ?? DEFAULT_WORKER_PATH;
  const corePath = options?.corePath ?? process.env.TESSERACT_CORE_PATH ?? DEFAULT_CORE_PATH;
  const timeoutMs = options?.timeoutMs ?? 30_000;

  const startTime = Date.now();
  let worker;

  try {
    worker = await createWorker('eng', 1, {
      langPath,
      workerPath,
      corePath,
      gzip: true,
      cacheMethod: 'none',
      logger: () => {},
    });
  } catch (err) {
    throw new OcrError(
      'ocr_unavailable',
      `Failed to initialize local OCR engine: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    let timeoutTimer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        reject(new OcrError('ocr_timeout', 'OCR processing timed out.'));
      }, timeoutMs);
    });

    const recognizePromise = worker.recognize(imageBuffer).then((res) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      return res;
    });

    const result = await Promise.race([recognizePromise, timeoutPromise]);
    const latencyMs = Date.now() - startTime;

    return {
      rawText: result.data.text ?? '',
      latencyMs,
    };
  } catch (err) {
    if (err instanceof OcrError) throw err;
    throw new OcrError(
      'ocr_failed',
      `OCR recognition failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    // Release worker resources in every possible outcome
    await worker.terminate().catch(() => {});
  }
}

export type ExtractionWithLatency = ExtractionResult & { latencyMs?: number };

/**
 * Full extraction pipeline: validates bytes/dimensions, preprocesses in memory,
 * runs local English OCR, parses labeled fields conservatively, and returns
 * the standard ExtractionResult shape.
 */
export async function extractFromIdCardImage(
  rawImageBuffer: Buffer,
  options?: OcrExecutionOptions,
): Promise<ExtractionWithLatency> {
  try {
    // 1. Validate format, size, decoded dimensions and preprocess
    const { buffer: preprocessedBuffer } = await validateAndPreprocessImage(rawImageBuffer);

    // 2. Perform OCR
    const { rawText, latencyMs } = await recognizeText(preprocessedBuffer, options);

    // 3. Parse conservative result contract
    const result = parseIdCardText(rawText);

    return {
      ...result,
      latencyMs,
    };
  } catch (err) {
    if (err instanceof ImageValidationError) {
      return failedResult(err.code, err.message);
    }
    if (err instanceof OcrError) {
      return unavailableResult(err.code, err.message);
    }
    return failedResult(
      'extraction_error',
      err instanceof Error ? err.message : 'An unexpected error occurred during image processing.',
    );
  }
}
