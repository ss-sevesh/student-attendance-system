import { NextRequest, NextResponse } from 'next/server';
import { getIdentityProvider } from '../../../../lib/auth/current-user';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../../../../lib/auth/cookie-policy';
import { checkOrigin, errorResponse } from '../../../../lib/auth/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const token = new NextRequest(request.url, { headers: request.headers }).cookies.get(SESSION_COOKIE_NAME)?.value;
    if (token) await getIdentityProvider().logout(token);
    const response = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      ...sessionCookieOptions(0, new URL(process.env.APP_ORIGIN ?? request.url).protocol), maxAge: 0,
    });
    return response;
  } catch (error) { return errorResponse(error); }
}
