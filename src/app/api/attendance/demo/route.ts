import { NextResponse } from 'next/server';
import { attendanceUser, readAttendanceJson } from '../../../../lib/attendance/http';
import { checkInDemo, deleteDemo, demoStatus, enrollDemo, resetDemo } from '../../../../lib/attendance/demo';
import { validateDescriptor } from '../../../../lib/attendance/service';
import { checkOrigin, errorResponse, HttpError } from '../../../../lib/auth/http';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  try { return NextResponse.json(demoStatus((await attendanceUser(request)).id), { headers }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await attendanceUser(request);
    const body = await readAttendanceJson(request);
    switch (body.action) {
      case 'enroll':
        if (body.consent !== true) throw new HttpError(400, 'consent_required', 'Agree to save your demo face reference first.');
        enrollDemo(user.id, validateDescriptor(body.descriptor));
        break;
      case 'check-in':
        return NextResponse.json(checkInDemo(user.id, validateDescriptor(body.descriptor)), { headers });
      case 'reset': resetDemo(user.id); break;
      default: throw new HttpError(400, 'invalid_action', 'Choose a valid demo action.');
    }
    return NextResponse.json(demoStatus(user.id), { headers });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await attendanceUser(request);
    checkOrigin(request);
    deleteDemo(user.id);
    return NextResponse.json(demoStatus(user.id), { headers });
  } catch (error) { return errorResponse(error); }
}
