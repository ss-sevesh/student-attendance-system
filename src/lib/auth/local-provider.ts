import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { IdentityStore, PublicUser } from './contracts';
import type { IdentityProvider, IssuedSession } from './provider';
import { hashPassword, verifyPassword } from './password';
import { validateCredentials, type Credentials } from './validation';

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createLocalIdentityProvider(store: IdentityStore): IdentityProvider {
  function issue(user: PublicUser, now: number): IssuedSession {
    const token = randomBytes(32).toString('base64url');
    return { user, token, expiresAt: now + SESSION_DURATION_MS };
  }

  return {
    async signup(credentials: Credentials, now = Date.now()) {
      credentials = validateCredentials(credentials);
      const user = { id: randomUUID(), email: credentials.email };
      const issued = issue(user, now);
      await store.createAccountWithSession(
        { ...user, passwordHash: await hashPassword(credentials.password), createdAt: now },
        { tokenDigest: tokenDigest(issued.token), userId: user.id, createdAt: now, expiresAt: issued.expiresAt },
      );
      return issued;
    },
    async login(credentials: Credentials, now = Date.now()) {
      credentials = validateCredentials(credentials);
      const account = await store.findAccountByEmail(credentials.email);
      if (!account) {
        await hashPassword(credentials.password);
        return null;
      }
      if (!(await verifyPassword(credentials.password, account.passwordHash))) return null;
      const issued = issue({ id: account.id, email: account.email }, now);
      await store.createSession({ tokenDigest: tokenDigest(issued.token), userId: account.id, createdAt: now, expiresAt: issued.expiresAt });
      return issued;
    },
    async getUser(token: string, now = Date.now()) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      return store.findSessionUser(tokenDigest(token), now);
    },
    async logout(token: string) {
      if (/^[A-Za-z0-9_-]{43}$/.test(token)) await store.revokeSession(tokenDigest(token));
    },
  };
}
