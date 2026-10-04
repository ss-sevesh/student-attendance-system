import { NextResponse } from 'next/server';
import { errorResponse } from '../../../../lib/auth/http';
import { readIdCardUpload } from '../../../../lib/id-card/request';
import { extractFromIdCardImage } from '../../../../lib/id-card/ocr';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { buffer } = await readIdCardUpload(request);
    const result = await extractFromIdCardImage(buffer);

    if (result.status === 'unavailable') {
      return NextResponse.json(result, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (result.status === 'failed') {
      return NextResponse.json(result, {
        status: 422,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
