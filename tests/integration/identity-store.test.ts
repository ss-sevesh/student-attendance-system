import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openIdentityStore } from '../../src/lib/auth/sqlite-store';

const stores: Array<ReturnType<typeof openIdentityStore>> = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});

function freshStore() {
  const path = join(tmpdir(), `student-test-${randomUUID()}.sqlite`);
  const store = openIdentityStore(path);
  stores.push(store);
  return { path, store };
}

it('persists an account and token digest after reopening', async () => {
  const { path, store } = freshStore();
  await store.createAccountWithSession({ id: 'u1', email: 'student@example.com', passwordHash: 'hash', createdAt: 100 },
    { tokenDigest: 'digest1', userId: 'u1', createdAt: 100, expiresAt: 200 });
  store.close();
  stores.splice(stores.indexOf(store), 1);
  const reopened = openIdentityStore(path);
  stores.push(reopened);
  expect(await reopened.findAccountByEmail('student@example.com')).toMatchObject({ id: 'u1', passwordHash: 'hash' });
  expect(await reopened.findSessionUser('digest1', 199)).toEqual({ id: 'u1', email: 'student@example.com' });
  expect(await reopened.findSessionUser('digest1', 200)).toBeNull();
});

it('rejects duplicate accounts atomically and enforces session ownership', async () => {
  const { store } = freshStore();
  await store.createAccountWithSession({ id: 'u1', email: 'student@example.com', passwordHash: 'hash', createdAt: 1 },
    { tokenDigest: 'first', userId: 'u1', createdAt: 1, expiresAt: 10 });
  await expect(store.createAccountWithSession({ id: 'u2', email: 'student@example.com', passwordHash: 'hash2', createdAt: 1 },
    { tokenDigest: 'second', userId: 'u2', createdAt: 1, expiresAt: 10 })).rejects.toThrow();
  expect(await store.findSessionUser('second', 2)).toBeNull();
  await expect(store.createSession({ tokenDigest: 'orphan', userId: 'missing', createdAt: 1, expiresAt: 10 })).rejects.toThrow();
  await store.revokeSession('first');
  expect(await store.findSessionUser('first', 2)).toBeNull();
});

it('refuses to open the development database under the test runner', () => {
  expect(() => openIdentityStore(join(process.cwd(), 'data', 'student.sqlite')))
    .toThrow('Tests may only open databases');
});
