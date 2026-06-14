import { NextResponse } from 'next/server';

import { isOrderSubmissionPayload } from '../../../domain/order-records';
import { createOrderRecord } from '../../../infrastructure/database/order-records';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    if (!isOrderSubmissionPayload(payload)) {
      return NextResponse.json({ error: 'Invalid order payload.' }, { status: 400 });
    }

    const record = await createOrderRecord(payload);
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    console.error('Failed to save order record.', error);
    return NextResponse.json({ error: 'Failed to save order record.' }, { status: 500 });
  }
}
