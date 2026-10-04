import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { createLocalIdentityProvider } from '../../src/lib/auth/local-provider';
import { openIdentityStore } from '../../src/lib/auth/sqlite-store';

it('resolves two owners, expires and revokes tokens, and exposes public fields only', async () => {
  const path = join(tmpdir(), `student-test-${randomUUID()}.sqlite`);
  const store = openIdentityStore(path);
  const provider = createLocalIdentityProvider(store);
  try {
    const a = await provider.signup({ email: ' A@Example.com ', password: 'long password a' }, 100);
    const b = await provider.signup({ email: 'b@example.com', password: 'long password b' }, 100);
    expect(a.token).not.toBe(b.token);
    expect(await provider.getUser(a.token, 101)).toEqual({ id: a.user.id, email: 'a@example.com' });
    await expect(provider.signup({ email: 'a@example.com', password: 'long password a' }, 100)).rejects.toThrow();
    expect(await provider.getUser(b.token, 101)).toEqual(b.user);
    expect(Object.keys(a.user).sort()).toEqual(['email', 'id']);
    expect(await provider.getUser(a.token, a.expiresAt)).toBeNull();
    await provider.logout(b.token);
    expect(await provider.getUser(b.token, 101)).toBeNull();
  } finally { store.close(); }
  const db = new DatabaseSync(path);
  try {
    const sessions = db.prepare('SELECT token_digest FROM sessions').all() as Array<{ token_digest: string }>;
    expect(sessions.every((session) => /^[0-9a-f]{64}$/.test(session.token_digest))).toBe(true);
  } finally { db.close(); }
});
