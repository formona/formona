import { NextResponse } from 'next/server';

import { ADMIN_DEMO_AUTH_CONFIG } from '../../../../constants';
import { listMeasurementRecords } from '../../../../infrastructure/database/measurement-records';

export const runtime = 'nodejs';

const ADMIN_PASSCODE_HEADER = 'x-formona-admin-passcode';

const getExpectedAdminPasscode = () => (
  process.env.FORMONA_ADMIN_PASSCODE
  ?? process.env.NEXT_PUBLIC_FORMONA_ADMIN_PASSCODE
  ?? ADMIN_DEMO_AUTH_CONFIG.defaultPasscode
);

const isAuthorized = (request: Request) => {
  const submittedPasscode = request.headers.get(ADMIN_PASSCODE_HEADER)?.trim();
  return Boolean(submittedPasscode) && submittedPasscode === getExpectedAdminPasscode();
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const records = await listMeasurementRecords();
    return NextResponse.json({ records });
  } catch (error) {
    console.error('Failed to load measurement records.', error);
    return NextResponse.json({ error: 'Failed to load measurement records.' }, { status: 500 });
  }
}
