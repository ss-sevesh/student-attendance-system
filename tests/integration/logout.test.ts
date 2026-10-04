import { expect, it } from 'vitest';
import { POST as signup } from '../../src/app/api/auth/signup/route';
import { POST as logout } from '../../src/app/api/auth/logout/route';
import { getIdentityProvider } from '../../src/lib/auth/current-user';
import { NextRequest } from 'next/server';

const origin = 'http://127.0.0.1:3100';

it('revokes an old token, clears its cookie, and tolerates repeated logout', async () => {
  const created = await signup(new Request(`${origin}/api/auth/signup`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ email: `logout-${crypto.randomUUID()}@example.com`, password: 'long enough password' }),
  }));
  const cookie = created.headers.get('set-cookie')?.split(';')[0] ?? '';
  const token = cookie.split('=')[1];
  expect(await getIdentityProvider().getUser(token)).not.toBeNull();
  const first = await logout(new Request(`${origin}/api/auth/logout`, { method: 'POST', headers: { origin, cookie } }));
  expect(first.status).toBe(204);
  expect(first.headers.get('set-cookie')).toContain('Max-Age=0');
  expect(await getIdentityProvider().getUser(token)).toBeNull();
  const second = await logout(new Request(`${origin}/api/auth/logout`, { method: 'POST', headers: { origin, cookie } }));
  expect(second.status).toBe(204);
  const nextRequest = new NextRequest(`${origin}/api/auth/logout`, { method: 'POST', headers: { origin, cookie, host: '127.0.0.1:3100' } });
  expect((await logout(nextRequest)).status).toBe(204);
});

it('rejects foreign-origin logout', async () => {
  const response = await logout(new Request(`${origin}/api/auth/logout`, { method: 'POST', headers: { origin: 'https://evil.example' } }));
  expect(response.status).toBe(403);
});
