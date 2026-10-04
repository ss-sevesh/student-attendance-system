import { NextRequest } from 'next/server';
import { getIdentityProvider } from '../auth/current-user';
import { SESSION_COOKIE_NAME } from '../auth/cookie-policy';
import { checkOrigin, HttpError } from '../auth/http';

export async function attendanceUser(request: Request) {
  const token = new NextRequest(request.url, { headers: request.headers }).cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? await getIdentityProvider().getUser(token) : null;
  if (!user) throw new HttpError(401, 'unauthorized', 'Sign in to use attendance.');
  return user;
}

export function requireAdmin(email: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || email.toLowerCase() !== adminEmail) throw new HttpError(403, 'forbidden', 'Admin access is required.');
}

export async function readAttendanceJson(request: Request): Promise<Record<string, unknown>> {
  checkOrigin(request);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new HttpError(415, 'unsupported_media_type', 'Send JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'invalid_input', 'Invalid request.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) throw new HttpError(413, 'payload_too_large', 'Request is too large.');
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new HttpError(400, 'invalid_input', 'Invalid request.'); }
}
