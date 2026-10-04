import { NextResponse } from 'next/server';
import { attendanceUser, readAttendanceJson } from '../../../../lib/attendance/http';
import { deleteEnrollment, enroll, validateDescriptor } from '../../../../lib/attendance/service';
import { checkOrigin, errorResponse, HttpError } from '../../../../lib/auth/http';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const user = await attendanceUser(request);
    const body = await readAttendanceJson(request);
    if (body.consent !== true) throw new HttpError(400, 'consent_required', 'Confirm face enrollment first.');
    enroll(user.id, validateDescriptor(body.descriptor));
    return NextResponse.json({ enrolled: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  try {
    const user = await attendanceUser(request);
    checkOrigin(request);
    deleteEnrollment(user.id);
    return NextResponse.json({ enrolled: false }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
