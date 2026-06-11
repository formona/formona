import { NextResponse } from 'next/server';

import { createMeasurementRecord } from '../../../infrastructure/database/measurement-records';
import { isMeasurementDataPayload } from '../../../domain/measurement-records';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    if (!isMeasurementDataPayload(payload)) {
      return NextResponse.json({ error: 'Invalid measurement payload.' }, { status: 400 });
    }

    const record = await createMeasurementRecord(payload);
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    console.error('Failed to save measurement record.', error);
    return NextResponse.json({ error: 'Failed to save measurement record.' }, { status: 500 });
  }
}
