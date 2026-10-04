import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { join } from 'node:path';
import { createLocalIdentityProvider } from './local-provider';
import { openIdentityStore } from './sqlite-store';
import { SESSION_COOKIE_NAME } from './cookie-policy';
import type { PublicUser } from './contracts';

let cachedProvider: ReturnType<typeof createLocalIdentityProvider> | undefined;

export function getIdentityProvider() {
  if (!cachedProvider) {
    const path = process.env.DATABASE_PATH ?? join(process.cwd(), 'data', 'student.sqlite');
    cachedProvider = createLocalIdentityProvider(openIdentityStore(path));
  }
  return cachedProvider;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? getIdentityProvider().getUser(token) : null;
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
