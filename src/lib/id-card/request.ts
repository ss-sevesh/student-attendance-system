/**
 * Request parsing and authentication for the protected ID-card extraction API.
 *
 * Rules:
 * - Requires a valid authenticated session; missing or expired sessions throw 401.
 * - Enforces origin check against CSRF.
 * - Requires multipart/form-data content type.
 * - Hard byte cap on incoming request stream (10 MB image + 64 KB multipart overhead)
 *   enforced during chunked stream reading before memory exhaustion.
 * - Requires exactly one file field. Multiple files or missing files are rejected.
 * - Never writes uploaded buffers to disk or SQLite.
 */

import { NextRequest } from 'next/server';
import { checkOrigin, HttpError } from '../auth/http';
import { getIdentityProvider } from '../auth/current-user';
import { SESSION_COOKIE_NAME } from '../auth/cookie-policy';
import { MAX_IMAGE_BYTES } from './image';

/** Max total multipart request size: 10 MB image + 64 KB overhead */
export const MAX_MULTIPART_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

export interface ValidatedUpload {
  buffer: Buffer;
  filename: string;
  userId: string;
}

/**
 * Validates request origin, session, content-type, streaming byte cap,
 * and extracts exactly one uploaded file buffer in memory.
 */
export async function readIdCardUpload(request: Request): Promise<ValidatedUpload> {
  // 1. Origin verification
  checkOrigin(request);

  // 2. Authenticated session verification
  let token = new NextRequest(request.url, { headers: request.headers })
    .cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    const rawCookie = request.headers.get('cookie') ?? '';
    const match = rawCookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) token = match[1];
  }

  if (!token) {
    throw new HttpError(401, 'unauthorized', 'You must be signed in to upload an ID card.');
  }

  const user = await getIdentityProvider().getUser(token);
  if (!user) {
    throw new HttpError(
      401,
      'unauthorized',
      'Your session is invalid or has expired. Please sign in again.',
    );
  }

  // 3. Content-Type check
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new HttpError(415, 'unsupported_media_type', 'Send multipart/form-data.');
  }

  // 4. Content-Length preliminary check
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_MULTIPART_REQUEST_BYTES) {
    throw new HttpError(
      413,
      'payload_too_large',
      'Upload exceeds maximum allowed size of 10 MB.',
    );
  }

  // 5. Bounded chunked stream reading
  const reader = request.body?.getReader();
  if (!reader) {
    throw new HttpError(400, 'missing_file', 'Please select an image file to upload.');
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > MAX_MULTIPART_REQUEST_BYTES) {
        throw new HttpError(
          413,
          'payload_too_large',
          'Upload exceeds maximum allowed size of 10 MB.',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // 6. Multipart parsing using web-standard Request.formData()
  const boundedRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: bodyBytes,
  });

  let formData: FormData;
  try {
    formData = await boundedRequest.formData();
  } catch {
    throw new HttpError(400, 'invalid_multipart', 'Failed to parse multipart form data.');
  }

  // 7. Validate file presence and count
  const fileEntries: File[] = [];
  for (const [, value] of formData.entries()) {
    if (
      value instanceof File ||
      (typeof value === 'object' && value !== null && 'arrayBuffer' in value)
    ) {
      fileEntries.push(value as File);
    }
  }

  if (fileEntries.length === 0) {
    throw new HttpError(400, 'missing_file', 'Please select an ID card image to upload.');
  }

  if (fileEntries.length > 1) {
    throw new HttpError(400, 'multiple_files', 'Upload exactly one ID card image.');
  }

  const file = fileEntries[0]!;

  if (file.size === 0) {
    throw new HttpError(400, 'empty_file', 'The selected image file is empty.');
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new HttpError(
      413,
      'file_too_large',
      'Image exceeds the maximum allowed size of 10 MB.',
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    buffer,
    filename: file.name || 'id-card',
    userId: user.id,
  };
}
