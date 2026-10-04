/**
 * In-memory image validation and preprocessing for ID-card OCR.
 *
 * Rules:
 * - Only JPEG, PNG, and WebP formats are accepted.
 * - Maximum file size is strictly capped at 10 MB.
 * - Bounded decoded pixel count prevents memory exhaustion or decompression bombs.
 * - Auto-orients EXIF rotation, converts to grayscale, and normalises contrast.
 * - All operations occur in memory; no images are written to disk or persisted.
 */

import sharp from 'sharp';

/** Hard limit on uploaded image buffer size: 10 MB */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Bounded decoded pixel limit (25 Megapixels, e.g. 5000x5000) */
export const MAX_DECODED_PIXELS = 25_000_000;

/** Supported format list */
export const SUPPORTED_FORMATS = ['jpeg', 'png', 'webp'] as const;
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

export class ImageValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

export interface ImageMetadata {
  format: SupportedFormat;
  width: number;
  height: number;
  byteLength: number;
}

export interface PreprocessedImage {
  buffer: Buffer;
  metadata: ImageMetadata;
}

/**
 * Detect image format from magic bytes in buffer header.
 * Returns null if unsupported or unrecognized.
 */
export function detectImageFormat(buf: Buffer): SupportedFormat | null {
  if (!buf || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP: RIFF .... WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Validates raw image buffer and preprocesses it in-memory for optimal OCR extraction.
 */
export async function validateAndPreprocessImage(
  inputBuffer: Buffer,
): Promise<PreprocessedImage> {
  if (!inputBuffer || inputBuffer.byteLength === 0) {
    throw new ImageValidationError('empty_file', 'Please provide a non-empty image file.');
  }

  if (inputBuffer.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      'file_too_large',
      'Image exceeds the maximum allowed size of 10 MB.',
    );
  }

  // Verify magic bytes
  const magicFormat = detectImageFormat(inputBuffer);
  if (!magicFormat) {
    throw new ImageValidationError(
      'unsupported_format',
      'Only JPEG, PNG, and WebP images are supported.',
    );
  }

  // Inspect decoded metadata with Sharp
  let meta: sharp.Metadata;
  try {
    meta = await sharp(inputBuffer, {
      limitInputPixels: MAX_DECODED_PIXELS,
      failOnError: true,
    }).metadata();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('pixel limit') || message.includes('Input image exceeds pixel limit')) {
      throw new ImageValidationError(
        'excessive_dimensions',
        'Image dimensions exceed maximum supported pixel limit.',
      );
    }
    throw new ImageValidationError(
      'corrupt_image',
      'The image file is corrupt or cannot be decoded.',
    );
  }

  // Format check from decoder
  if (!meta.format || !(SUPPORTED_FORMATS as readonly string[]).includes(meta.format)) {
    throw new ImageValidationError(
      'unsupported_format',
      'Only JPEG, PNG, and WebP images are supported.',
    );
  }

  // Reject animated WebP or multi-page formats
  if (meta.pages && meta.pages > 1) {
    throw new ImageValidationError(
      'animated_unsupported',
      'Animated or multi-page images are not supported.',
    );
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new ImageValidationError('corrupt_image', 'Image dimensions are invalid.');
  }

  if (width * height > MAX_DECODED_PIXELS) {
    throw new ImageValidationError(
      'excessive_dimensions',
      'Image dimensions exceed maximum supported pixel limit.',
    );
  }

  // Preprocess for OCR:
  // - auto-orient by EXIF orientation
  // - bound max dimension to 2400px (preserves crispness without wasting CPU)
  // - convert to grayscale
  // - normalize contrast
  // - emit PNG buffer for lossless OCR input
  const preprocessedBuffer = await sharp(inputBuffer, {
    limitInputPixels: MAX_DECODED_PIXELS,
  })
    .rotate()
    .resize({
      width: 2400,
      height: 2400,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();

  return {
    buffer: preprocessedBuffer,
    metadata: {
      format: meta.format as SupportedFormat,
      width,
      height,
      byteLength: inputBuffer.byteLength,
    },
  };
}
