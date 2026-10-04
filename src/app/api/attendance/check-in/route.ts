import { NextResponse } from 'next/server';
import { attendanceUser, readAttendanceJson } from '../../../../lib/attendance/http';
import { checkIn, validateDescriptor } from '../../../../lib/attendance/service';
import { errorResponse, HttpError } from '../../../../lib/auth/http';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const user = await attendanceUser(request);
    const body = await readAttendanceJson(request);
    if (!Number.isSafeInteger(body.periodId)) throw new HttpError(400, 'invalid_period', 'Choose a valid period.');
    const result = checkIn(user.id, body.periodId as number, validateDescriptor(body.descriptor));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
