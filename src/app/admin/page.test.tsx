import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ADMIN_DEMO_AUTH_CONFIG } from '../../constants';
import { analyzeFaceLandmarks } from '../../domain/face-analysis';
import { EYEBROW_METRIC_FIXTURES } from '../../domain/eyebrow-metric-fixtures';
import { buildMeasurementDataPayload } from '../../domain/measurement-payload';
import {
  buildOrderDataPayload,
  buildOrderSubmissionPayload,
  type StoredOrderRecord,
} from '../../domain/order-records';
import AdminPage from './page';

const buildStoredRecords = (): StoredOrderRecord[] => {
  const fixture = EYEBROW_METRIC_FIXTURES[0];
  const analysis = analyzeFaceLandmarks(fixture.landmarks, fixture.ipdMm, fixture.dimensions);

  if (!analysis) throw new Error('Expected fixture analysis');

  const measurement = buildMeasurementDataPayload({
    analysis,
    measuredAtIso: '2026-06-12T00:00:00.000Z',
    selectedStyle: {
      id: 'soft-arch',
      name: '부드러운 아치형',
      description: '테스트 추천 스타일',
      path: 'M0,0 Q50,20 100,0',
    },
  });
  const submission = buildOrderSubmissionPayload({
    submittedAtIso: '2026-06-12T00:02:00.000Z',
    measurement,
    shippingAddress: {
      recipient: '홍길동',
      phone: '010-1234-5678',
      postalCode: '06142',
      baseAddress: '서울 강남구 테헤란로 123',
      detailAddress: '101동 1203호',
      deliveryMemo: '문 앞에 놓아주세요',
    },
  });

  return [{
    id: 'order-1',
    orderedAtIso: submission.submittedAtIso,
    measurementRecordId: 'measurement-1',
    status: 'submitted',
    payload: buildOrderDataPayload({
      submission,
      measurementRecordId: 'measurement-1',
      orderedAtIso: submission.submittedAtIso,
    }),
    measurement: {
      id: 'measurement-1',
      savedAtIso: '2026-06-12T00:01:00.000Z',
      payload: buildMeasurementDataPayload({
        analysis,
        measuredAtIso: '2026-06-12T00:00:00.000Z',
        selectedStyle: {
          id: 'soft-arch',
          name: '부드러운 아치형',
          description: '테스트 추천 스타일',
          path: 'M0,0 Q50,20 100,0',
        },
      }),
    },
  }];
};

describe('AdminPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const passcode = new Headers(init?.headers).get('x-formona-admin-passcode');

      if (passcode !== ADMIN_DEMO_AUTH_CONFIG.defaultPasscode) {
        return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401 });
      }

      return new Response(JSON.stringify({ records: buildStoredRecords() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));
  });

  it('hides order records until the demo passcode is entered', async () => {
    render(<AdminPage />);

    expect(await screen.findByRole('heading', { name: '관리자 접근' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '주문 및 측정 정보' })).not.toBeInTheDocument();
    expect(screen.queryByText('부드러운 아치형')).not.toBeInTheDocument();
  });

  it('rejects an incorrect demo passcode', async () => {
    render(<AdminPage />);

    fireEvent.change(await screen.findByLabelText('비밀번호'), { target: { value: 'wrong-passcode' } });
    fireEvent.click(screen.getByRole('button', { name: '접속' }));

    expect(await screen.findByText('비밀번호가 올바르지 않습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '주문 및 측정 정보' })).not.toBeInTheDocument();
  });

  it('toggles passcode visibility from the admin login form', async () => {
    render(<AdminPage />);

    const passcodeInput = await screen.findByLabelText('비밀번호');

    expect(passcodeInput).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 보기' }));

    expect(passcodeInput).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 숨기기' }));

    expect(passcodeInput).toHaveAttribute('type', 'password');
  });

  it('shows order records after the demo passcode is accepted', async () => {
    render(<AdminPage />);

    fireEvent.change(await screen.findByLabelText('비밀번호'), {
      target: { value: ADMIN_DEMO_AUTH_CONFIG.defaultPasscode },
    });
    fireEvent.click(screen.getByRole('button', { name: '접속' }));

    expect(await screen.findByRole('heading', { name: '주문 및 측정 정보' })).toBeInTheDocument();
    expect(screen.getAllByText('홍길동').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/부드러운 아치형/).length).toBeGreaterThan(0);
    expect(screen.getByText('서울 강남구 테헤란로 123')).toBeInTheDocument();
    expect(sessionStorage.getItem(ADMIN_DEMO_AUTH_CONFIG.sessionStorageKey)).toBe(ADMIN_DEMO_AUTH_CONFIG.defaultPasscode);
  });

  it('locks the admin page again after logout', async () => {
    sessionStorage.setItem(ADMIN_DEMO_AUTH_CONFIG.sessionStorageKey, ADMIN_DEMO_AUTH_CONFIG.defaultPasscode);

    render(<AdminPage />);

    expect(await screen.findByRole('heading', { name: '주문 및 측정 정보' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(await screen.findByRole('heading', { name: '관리자 접근' })).toBeInTheDocument();
    expect(sessionStorage.getItem(ADMIN_DEMO_AUTH_CONFIG.sessionStorageKey)).toBeNull();
    expect(screen.queryByText('부드러운 아치형')).not.toBeInTheDocument();
  });
});
