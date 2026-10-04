import type { PublicUser } from './contracts';
import type { Credentials } from './validation';

export type IssuedSession = Readonly<{ user: PublicUser; token: string; expiresAt: number }>;

export interface IdentityProvider {
  signup(credentials: Credentials, now?: number): Promise<IssuedSession>;
  login(credentials: Credentials, now?: number): Promise<IssuedSession | null>;
  getUser(token: string, now?: number): Promise<PublicUser | null>;
  logout(token: string): Promise<void>;
}
