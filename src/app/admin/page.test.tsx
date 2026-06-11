import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ADMIN_DEMO_AUTH_CONFIG } from '../../constants';
import { analyzeFaceLandmarks } from '../../domain/face-analysis';
import { EYEBROW_METRIC_FIXTURES } from '../../domain/eyebrow-metric-fixtures';
import { buildMeasurementDataPayload } from '../../domain/measurement-payload';
import {
  addMeasurementRecord,
  MEASUREMENT_RECORD_STORAGE_KEY,
  serializeMeasurementRecords,
} from '../../domain/measurement-records';
import AdminPage from './page';

const buildStoredRecords = () => {
  const fixture = EYEBROW_METRIC_FIXTURES[0];
  const analysis = analyzeFaceLandmarks(fixture.landmarks, fixture.ipdMm, fixture.dimensions);

  if (!analysis) throw new Error('Expected fixture analysis');

  return addMeasurementRecord(
    [],
    buildMeasurementDataPayload({
      analysis,
      measuredAtIso: '2026-06-12T00:00:00.000Z',
      selectedStyle: {
        id: 'soft-arch',
        name: '부드러운 아치형',
        description: '테스트 추천 스타일',
        path: 'M0,0 Q50,20 100,0',
      },
    }),
    new Date('2026-06-12T00:01:00.000Z'),
  );
};

const saveFixtureRecords = () => {
  localStorage.setItem(MEASUREMENT_RECORD_STORAGE_KEY, serializeMeasurementRecords(buildStoredRecords()));
};

describe('AdminPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('hides measurement records until the demo passcode is entered', async () => {
    saveFixtureRecords();

    render(<AdminPage />);

    expect(await screen.findByRole('heading', { name: '관리자 접근' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '사용자 측정 수치' })).not.toBeInTheDocument();
    expect(screen.queryByText('부드러운 아치형')).not.toBeInTheDocument();
  });

  it('rejects an incorrect demo passcode', async () => {
    saveFixtureRecords();

    render(<AdminPage />);

    fireEvent.change(await screen.findByLabelText('비밀번호'), { target: { value: 'wrong-passcode' } });
    fireEvent.click(screen.getByRole('button', { name: '접속' }));

    expect(screen.getByText('비밀번호가 올바르지 않습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '사용자 측정 수치' })).not.toBeInTheDocument();
  });

  it('shows measurement records after the demo passcode is accepted', async () => {
    saveFixtureRecords();

    render(<AdminPage />);

    fireEvent.change(await screen.findByLabelText('비밀번호'), {
      target: { value: ADMIN_DEMO_AUTH_CONFIG.passcode },
    });
    fireEvent.click(screen.getByRole('button', { name: '접속' }));

    expect(await screen.findByRole('heading', { name: '사용자 측정 수치' })).toBeInTheDocument();
    expect(screen.getAllByText('부드러운 아치형').length).toBeGreaterThan(0);
    expect(sessionStorage.getItem(ADMIN_DEMO_AUTH_CONFIG.sessionStorageKey)).toBe(ADMIN_DEMO_AUTH_CONFIG.unlockedValue);
  });

  it('locks the admin page again after logout', async () => {
    saveFixtureRecords();
    sessionStorage.setItem(ADMIN_DEMO_AUTH_CONFIG.sessionStorageKey, ADMIN_DEMO_AUTH_CONFIG.unlockedValue);

    render(<AdminPage />);

    expect(await screen.findByRole('heading', { name: '사용자 측정 수치' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(await screen.findByRole('heading', { name: '관리자 접근' })).toBeInTheDocument();
    expect(sessionStorage.getItem(ADMIN_DEMO_AUTH_CONFIG.sessionStorageKey)).toBeNull();
    expect(screen.queryByText('부드러운 아치형')).not.toBeInTheDocument();
  });
});
