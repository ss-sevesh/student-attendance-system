export const SESSION_COOKIE_NAME = 'student_session';

export function sessionCookieOptions(expiresAt: number, protocol: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: protocol === 'https:',
    expires: new Date(expiresAt),
  };
}
