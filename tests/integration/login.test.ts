import { expect, it } from 'vitest';
import { POST as signup } from '../../src/app/api/auth/signup/route';
import { POST as login } from '../../src/app/api/auth/login/route';

const origin = 'http://127.0.0.1:3100';
function request(path: string, email: string, password: string, requestOrigin = origin) {
  return new Request(`${origin}/api/auth/${path}`, {
    method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

it('issues a fresh session and gives the same response for unknown email and wrong password', async () => {
  const email = `login-${crypto.randomUUID()}@example.com`;
  const created = await signup(request('signup', email, 'long enough password'));
  const signedIn = await login(request('login', email.toUpperCase(), 'long enough password'));
  expect(signedIn.status).toBe(200);
  expect(signedIn.headers.get('set-cookie')).not.toBe(created.headers.get('set-cookie'));
  const unknown = await login(request('login', `missing-${crypto.randomUUID()}@example.com`, 'long enough password'));
  const wrong = await login(request('login', email, 'wrong password long'));
  expect(unknown.status).toBe(401);
  expect(wrong.status).toBe(401);
  expect(await unknown.json()).toEqual(await wrong.json());
});

it('rejects foreign-origin mutations', async () => {
  const response = await login(request('login', 'a@example.com', 'long enough password', 'https://evil.example'));
  expect(response.status).toBe(403);
});
