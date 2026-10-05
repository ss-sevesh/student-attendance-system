import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { checkOrigin, errorResponse, HttpError } from '../../../lib/auth/http';
import { readAttendanceJson } from '../../../lib/attendance/http';
import { allPeriods, saveTimetableDay, validateDescriptor } from '../../../lib/attendance/service';
import { initializePrototype, prototypeStatus, prototypePhoto, savePrototypePhoto, removePrototypePhoto, resetPrototypeStudent, prototypeCheckIn } from '../../../lib/attendance/prototype';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.has('photo')) return new Response(new Uint8Array(prototypePhoto()), { headers: { ...headers, 'Content-Type': 'image/jpeg' } });
    return NextResponse.json({ ...prototypeStatus(), timetable: allPeriods() }, { headers });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    const body = await readAttendanceJson(request);
    initializePrototype();
    saveTimetableDay(body.weekday, body.periods);
    return NextResponse.json({ periods: allPeriods() }, { headers });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const reader = request.body?.getReader();
      if (!reader) throw new HttpError(400, 'invalid_photo', 'Choose a photo first.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 11 * 1024 * 1024) { await reader.cancel(); throw new HttpError(413, 'photo_too_large', 'Choose a photo smaller than 10 MB.'); }
        chunks.push(value);
      }
      const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData();
      const file = form.get('photo');
      if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new HttpError(400, 'invalid_photo', 'Choose a JPEG, PNG or WebP photo under 10 MB.');
      if (form.get('consent') !== 'true') throw new HttpError(400, 'consent_required', 'Agree to save your photo first.');
      const descriptor = validateDescriptor(JSON.parse(String(form.get('descriptor'))));
      let photo: Buffer;
      try { photo = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 }).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(); }
      catch { throw new HttpError(400, 'invalid_photo', 'This photo could not be read. Choose another image.'); }
      savePrototypePhoto(photo, descriptor);
      return NextResponse.json(prototypeStatus(), { headers });
    }
    const body = await readAttendanceJson(request);
    if (body.action === 'reset') {
      resetPrototypeStudent();
      return NextResponse.json(prototypeStatus(), { headers });
    }
    return NextResponse.json(prototypeCheckIn(validateDescriptor(body.descriptor)), { headers });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try { checkOrigin(request); removePrototypePhoto(); return NextResponse.json(prototypeStatus(), { headers }); }
  catch (error) { return errorResponse(error); }
}
