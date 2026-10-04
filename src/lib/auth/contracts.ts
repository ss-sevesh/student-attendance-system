export type PublicUser = Readonly<{ id: string; email: string }>;
export type Account = PublicUser & Readonly<{ passwordHash: string; createdAt: number }>;
export type Session = Readonly<{ tokenDigest: string; userId: string; createdAt: number; expiresAt: number }>;

export interface IdentityStore {
  createAccountWithSession(account: Account, session: Session): Promise<void>;
  findAccountByEmail(email: string): Promise<Account | null>;
  createSession(session: Session): Promise<void>;
  findSessionUser(tokenDigest: string, now: number): Promise<PublicUser | null>;
  revokeSession(tokenDigest: string): Promise<void>;
  close(): void;
}
