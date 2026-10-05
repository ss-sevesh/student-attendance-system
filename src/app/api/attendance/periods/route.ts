import { NextResponse } from 'next/server';
import { attendanceUser, readAttendanceJson, requireAdmin } from '../../../../lib/attendance/http';
import { addPeriod, allPeriods, deletePeriod, saveTimetableDay } from '../../../../lib/attendance/service';
import { errorResponse, HttpError } from '../../../../lib/auth/http';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const user = await attendanceUser(request);
    requireAdmin(user.email);
    return NextResponse.json({ periods: allPeriods() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const user = await attendanceUser(request);
    requireAdmin(user.email);
    const body = await readAttendanceJson(request);
    addPeriod(body.weekday, body.startTime, body.name);
    return NextResponse.json({ periods: allPeriods() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  try {
    const user = await attendanceUser(request);
    requireAdmin(user.email);
    const body = await readAttendanceJson(request);
    if (!Number.isSafeInteger(body.id)) throw new HttpError(400, 'invalid_period', 'Choose a valid period.');
    deletePeriod(body.id as number);
    return NextResponse.json({ periods: allPeriods() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const user = await attendanceUser(request);
    requireAdmin(user.email);
    const body = await readAttendanceJson(request);
    saveTimetableDay(body.weekday, body.periods);
    return NextResponse.json({ periods: allPeriods() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
