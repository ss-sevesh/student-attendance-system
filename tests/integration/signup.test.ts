import { expect, it } from 'vitest';
import { POST } from '../../src/app/api/auth/signup/route';
import { checkOrigin } from '../../src/lib/auth/http';

const origin = 'http://127.0.0.1:3100';
function request(email: string, password = 'long enough password') {
  return new Request(`${origin}/api/auth/signup`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

it('creates a session cookie and public response, then rejects a canonical duplicate', async () => {
  const email = `signup-${crypto.randomUUID()}@example.com`;
  const first = await POST(request(` ${email.toUpperCase()} `));
  expect(first.status).toBe(201);
  expect(first.headers.get('set-cookie')).toContain('HttpOnly');
  const body = await first.json();
  expect(body.user).toMatchObject({ email });
  expect(Object.keys(body.user).sort()).toEqual(['email', 'id']);
  const second = await POST(request(email));
  expect(second.status).toBe(409);
  expect(await second.json()).toMatchObject({ error: { code: 'duplicate_email' } });
});

it('lets only one of two simultaneous canonical duplicates create an account', async () => {
  const email = `race-${crypto.randomUUID()}@example.com`;
  const responses = await Promise.all([POST(request(email)), POST(request(email.toUpperCase()))]);
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
});

it('accepts the browser origin when the server request URL uses an internal host', () => {
  expect(() => checkOrigin(new Request('http://localhost:3100/api/auth/signup', {
    headers: { host: '127.0.0.1:3100', origin },
  }))).not.toThrow();
});

it('returns actionable validation feedback for a short password', async () => {
  const response = await POST(request('valid@example.com', 'short'));
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: { code: 'invalid_input', message: 'Use a password of 12 to 128 characters.' } });
});
