import type { Account, IdentityStore, PublicUser, Session } from './contracts';
import { openDatabase } from '../db/sqlite';

export function openIdentityStore(path: string): IdentityStore {
  const db = openDatabase(path);
  const insertAccount = db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)');
  const insertSession = db.prepare('INSERT INTO sessions (token_digest, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)');
  const lookupAccount = db.prepare('SELECT id, email, password_hash AS passwordHash, created_at AS createdAt FROM users WHERE email = ?');
  const lookupSession = db.prepare('SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_digest = ? AND expires_at > ?');
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token_digest = ?');

  function addSession(session: Session): void {
    insertSession.run(session.tokenDigest, session.userId, session.createdAt, session.expiresAt);
  }

  return {
    async createAccountWithSession(account, session) {
      if (session.userId !== account.id) throw new Error('Session owner mismatch');
      db.exec('BEGIN IMMEDIATE');
      try {
        insertAccount.run(account.id, account.email, account.passwordHash, account.createdAt);
        addSession(session);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async findAccountByEmail(email): Promise<Account | null> {
      return (lookupAccount.get(email) as Account | undefined) ?? null;
    },
    async createSession(session) { addSession(session); },
    async findSessionUser(tokenDigest, now): Promise<PublicUser | null> {
      return (lookupSession.get(tokenDigest, now) as PublicUser | undefined) ?? null;
    },
    async revokeSession(tokenDigest) { deleteSession.run(tokenDigest); },
    close() { db.close(); },
  };
}
