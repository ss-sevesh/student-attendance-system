import { NextResponse } from 'next/server';
import { readAttendanceJson } from '../../../../lib/attendance/http';
import { errorResponse, HttpError } from '../../../../lib/auth/http';
import { fetchStudentDetails, validatePortalCredentials } from '../../../../lib/linways/service';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
let activeRequests = 0;

export async function POST(request: Request) {
  let acquired = false;
  try {
    const credentials = validatePortalCredentials(await readAttendanceJson(request));
    if (activeRequests >= 3) throw new HttpError(429, 'portal_busy', 'Student details are busy. Try again in a moment.');
    activeRequests++; acquired = true;
    const profile = await fetchStudentDetails(credentials.email, credentials.password);
    return NextResponse.json({ profile, fetchedAt: Date.now(), source: 'Linways' }, { headers });
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } finally { if (acquired) activeRequests--; }
}
