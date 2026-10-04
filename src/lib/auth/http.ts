import { NextResponse } from 'next/server';
import { validateCredentials, type Credentials } from './validation';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './cookie-policy';
import type { IssuedSession } from './provider';

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export function checkOrigin(request: Request): void {
  const url = new URL(request.url);
  const expected = process.env.APP_ORIGIN ?? `${url.protocol}//${request.headers.get('host') ?? url.host}`;
  if (request.headers.get('origin') !== expected) {
    throw new HttpError(403, 'invalid_origin', 'Request origin is not allowed.');
  }
}

export async function readCredentials(request: Request): Promise<Credentials> {
  checkOrigin(request);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    throw new HttpError(415, 'unsupported_media_type', 'Send JSON credentials.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'invalid_input', 'Enter a valid email and password.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) throw new HttpError(413, 'payload_too_large', 'Request is too large.');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    try { return validateCredentials(json); }
    catch (error) {
      throw new HttpError(400, 'invalid_input', error instanceof Error ? error.message : 'Enter a valid email and password.');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'invalid_input', 'Enter a valid email and password.');
  } finally { reader.releaseLock(); }
}

export function errorResponse(error: unknown): NextResponse {
  const known = error instanceof HttpError ? error : new HttpError(500, 'server_error', 'Something went wrong. Try again.');
  return NextResponse.json({ error: { code: known.code, message: known.message } }, { status: known.status });
}

export function sessionResponse(issued: IssuedSession, status: number, request: Request): NextResponse {
  const response = NextResponse.json({ user: issued.user }, { status, headers: { 'Cache-Control': 'no-store' } });
  const protocol = new URL(process.env.APP_ORIGIN ?? request.url).protocol;
  response.cookies.set(SESSION_COOKIE_NAME, issued.token, sessionCookieOptions(issued.expiresAt, protocol));
  return response;
}
