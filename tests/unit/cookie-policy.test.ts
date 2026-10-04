import { expect, it } from 'vitest';
import { sessionCookieOptions } from '../../src/lib/auth/cookie-policy';

it('uses an HTTP-only seven-day cookie with HTTPS protection', () => {
  expect(sessionCookieOptions(100, 'https:')).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', secure: true, expires: new Date(100) });
  expect(sessionCookieOptions(100, 'http:').secure).toBe(false);
});
