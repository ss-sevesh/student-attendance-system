import { NextResponse } from 'next/server';
import { attendanceUser } from '../../../../lib/attendance/http';
import { status } from '../../../../lib/attendance/service';
import { errorResponse } from '../../../../lib/auth/http';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const user = await attendanceUser(request);
    return NextResponse.json(status(user.id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
