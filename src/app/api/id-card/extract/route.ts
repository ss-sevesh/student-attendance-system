import { NextResponse } from 'next/server';
import { errorResponse } from '../../../../lib/auth/http';
import { readIdCardUpload } from '../../../../lib/id-card/request';
import { extractFromIdCardImage } from '../../../../lib/id-card/ocr';
import type { ExtractionResult, IdCardReviewResult } from '../../../../lib/id-card/types';

export const runtime = 'nodejs';

function reviewResult(result: ExtractionResult): IdCardReviewResult {
  return {
    source: result.source,
    status: result.status,
    fields: {
      birthDate: result.fields.birthDate,
      residentialAddress: result.fields.residentialAddress,
      phone: result.fields.phone,
    },
    ...(result.error ? { error: result.error } : {}),
  };
}

export async function POST(request: Request) {
  try {
    const { buffer } = await readIdCardUpload(request);
    const result = await extractFromIdCardImage(buffer);

    if (result.status === 'unavailable') {
      return NextResponse.json(reviewResult(result), {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (result.status === 'failed') {
      return NextResponse.json(reviewResult(result), {
        status: 422,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return NextResponse.json(reviewResult(result), {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
