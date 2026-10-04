import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { POST as signup } from '../../src/app/api/auth/signup/route';
import { DELETE, GET, POST } from '../../src/app/api/attendance/demo/route';

const origin = 'http://127.0.0.1:3100';
const descriptor = Array(128).fill(0.01) as number[];
process.env.ATTENDANCE_KEY = '01'.repeat(32);

function request(method: string, cookie = '', body?: unknown, requestOrigin = origin) {
  return new Request(`${origin}/api/attendance/demo`, {
    method,
    headers: { origin: requestOrigin, cookie, 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function session() {
  const created = await signup(new Request(`${origin}/api/auth/signup`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ email: `demo-route-${randomUUID()}@example.com`, password: 'password-horse-battery' }),
  }));
  expect(created.status).toBe(201);
  return created.headers.get('set-cookie')!.split(';')[0];
}

it('requires authentication for every demo endpoint method', async () => {
  expect((await GET(request('GET'))).status).toBe(401);
  expect((await POST(request('POST', '', { action: 'reset' }))).status).toBe(401);
  expect((await DELETE(request('DELETE'))).status).toBe(401);
});

it('enforces origin, enrollment consent, valid descriptors, and valid actions', async () => {
  const cookie = await session();
  expect((await POST(request('POST', cookie, { action: 'enroll', consent: true, descriptor }, 'https://evil.example'))).status).toBe(403);
  expect((await DELETE(request('DELETE', cookie, undefined, 'https://evil.example'))).status).toBe(403);
  expect((await POST(request('POST', cookie, { action: 'enroll', descriptor }))).status).toBe(400);
  expect((await POST(request('POST', cookie, { action: 'enroll', consent: true, descriptor: [1, 2] }))).status).toBe(400);
  expect((await POST(request('POST', cookie, { action: 'check-in', descriptor: [1, 2] }))).status).toBe(400);
  expect((await POST(request('POST', cookie, { action: 'unknown' }))).status).toBe(400);
  expect(await (await GET(request('GET', cookie))).json()).toEqual({ enrolled: false, recordedAt: null });
});

it('persists a successful demo check-in and supports reset and deletion through the API', async () => {
  const cookie = await session();
  expect((await POST(request('POST', cookie, { action: 'enroll', consent: true, descriptor }))).status).toBe(200);
  const checkedIn = await POST(request('POST', cookie, { action: 'check-in', descriptor }));
  expect(checkedIn.status).toBe(200);
  const result = await checkedIn.json();
  expect(result).toMatchObject({ status: 'present', recordedAt: expect.any(Number) });
  const saved = await GET(request('GET', cookie));
  expect(saved.headers.get('cache-control')).toBe('no-store');
  expect(await saved.json()).toEqual({ enrolled: true, recordedAt: result.recordedAt });
  const mismatch = await POST(request('POST', cookie, { action: 'check-in', descriptor: Array(128).fill(1) }));
  expect(mismatch.status).toBe(422);
  expect((await POST(request('POST', cookie, { action: 'reset' }))).status).toBe(200);
  expect(await (await GET(request('GET', cookie))).json()).toEqual({ enrolled: true, recordedAt: null });
  expect((await DELETE(request('DELETE', cookie))).status).toBe(200);
  expect(await (await GET(request('GET', cookie))).json()).toEqual({ enrolled: false, recordedAt: null });
});
