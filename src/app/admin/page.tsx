"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, LockKeyhole, LogOut, RefreshCw } from 'lucide-react';
import {
  parseMeasurementRecords,
  type StoredMeasurementRecord,
} from '../../domain/measurement-records';
import { EYEBROW_METRIC_DISPLAY_ROWS } from '../../domain/measurement-copy';
import { ADMIN_DEMO_AUTH_CONFIG } from '../../constants';

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const escapeCsvValue = (value: string | number | boolean | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

const downloadTextFile = (filename: string, data: string, type: string) => {
  const blob = new Blob([data], { type });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

const ADMIN_PASSCODE_HEADER = 'x-formona-admin-passcode';

const parseRecordsResponse = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('records' in value)) return [];

  return parseMeasurementRecords(JSON.stringify((value as { records: unknown }).records));
};

const buildRecordsCsv = (records: StoredMeasurementRecord[]) => {
  const metricHeaders = EYEBROW_METRIC_DISPLAY_ROWS.map((row) => `${row.label}(mm)`);
  const headers = [
    'recordId',
    'savedAtIso',
    'measuredAtIso',
    'faceShape',
    'selectedStyle',
    'ipdMm',
    'qualityReportable',
    'overallConfidence',
    'maxEstimatedErrorMm',
    ...metricHeaders,
  ];

  const rows = records.map((record) => {
    const metricValues = EYEBROW_METRIC_DISPLAY_ROWS.map((row) => (
      record.payload.metrics.find((metric) => metric.key === row.key)?.valueMm ?? ''
    ));

    return [
      record.id,
      record.savedAtIso,
      record.payload.measuredAtIso,
      record.payload.faceShape,
      record.payload.selectedStyle?.name ?? '',
      record.payload.ipdMm,
      record.payload.quality.reportable,
      record.payload.quality.overallConfidence ?? '',
      record.payload.quality.maxEstimatedErrorMm ?? '',
      ...metricValues,
    ];
  });

  return [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
  ].join('\n');
};

export default function AdminPage() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'locked' | 'unlocked'>('checking');
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [records, setRecords] = useState<StoredMeasurementRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const applyRecords = useCallback((nextRecords: StoredMeasurementRecord[]) => {
    setRecords(nextRecords);
    setSelectedRecordId((currentId) => (
      currentId && nextRecords.some((record) => record.id === currentId)
        ? currentId
        : nextRecords[0]?.id ?? null
    ));
  }, []);

  const loadRecords = useCallback(async (adminPasscode: string, persistPasscode = false) => {
    const nextPasscode = adminPasscode.trim();

    if (!nextPasscode) {
      setAuthStatus('locked');
      setAuthError('비밀번호를 입력해주세요.');
      return false;
    }

    setRecordsLoading(true);
    setRecordsError(null);

    try {
      const response = await fetch('/api/admin/measurements', {
        method: 'GET',
        headers: {
          [ADMIN_PASSCODE_HEADER]: nextPasscode,
        },
        cache: 'no-store',
      });

      if (response.status === 401) {
        sessionStorage.removeItem(ADMIN_DEMO_AUTH_CONFIG.sessionStorageKey);
        applyRecords([]);
        setAuthStatus('locked');
        setAuthError('비밀번호가 올바르지 않습니다.');
        return false;
      }

      if (!response.ok) {
        throw new Error(`Admin measurements request failed: ${response.status}`);
      }

      const nextRecords = parseRecordsResponse(await response.json());

      if (persistPasscode) {
        sessionStorage.setItem(ADMIN_DEMO_AUTH_CONFIG.sessionStorageKey, nextPasscode);
      }

      setPasscode('');
      setAuthError('');
      setAuthStatus('unlocked');
      applyRecords(nextRecords);
      return true;
    } catch {
      setRecordsError('측정 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      setAuthStatus((currentStatus) => (currentStatus === 'checking' ? 'locked' : currentStatus));
      return false;
    } finally {
      setRecordsLoading(false);
    }
  }, [applyRecords]);

  const refreshRecords = useCallback(() => {
    const storedPasscode = sessionStorage.getItem(ADMIN_DEMO_AUTH_CONFIG.sessionStorageKey);

    if (!storedPasscode) {
      setAuthStatus('locked');
      return;
    }

    void loadRecords(storedPasscode);
  }, [loadRecords]);

  useEffect(() => {
    const storedPasscode = sessionStorage.getItem(ADMIN_DEMO_AUTH_CONFIG.sessionStorageKey);

    if (!storedPasscode) {
      setAuthStatus('locked');
      return;
    }

    void loadRecords(storedPasscode);
  }, [loadRecords]);

  const selectedRecord = useMemo(() => (
    records.find((record) => record.id === selectedRecordId) ?? records[0] ?? null
  ), [records, selectedRecordId]);
  const reportableCount = records.filter((record) => record.payload.quality.reportable).length;
  const latestRecord = records[0] ?? null;

  const handleDownloadJson = () => {
    downloadTextFile(
      `formona-measurements-${Date.now()}.json`,
      JSON.stringify(records, null, 2),
      'application/json;charset=utf-8',
    );
  };

  const handleDownloadCsv = () => {
    downloadTextFile(
      `formona-measurements-${Date.now()}.csv`,
      buildRecordsCsv(records),
      'text/csv;charset=utf-8',
    );
  };

  const handleUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    void loadRecords(passcode, true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_DEMO_AUTH_CONFIG.sessionStorageKey);
    setRecords([]);
    setSelectedRecordId(null);
    setPasscode('');
    setAuthError('');
    setAuthStatus('locked');
  };

  if (authStatus !== 'unlocked') {
    return (
      <main className="flex h-screen items-center justify-center overflow-y-auto bg-white px-4 py-6 text-main-brown sm:px-6">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-sm rounded-lg border border-main-brown/10 bg-white p-6 shadow-sm"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-main-brown/[0.06] text-main-brown">
            <LockKeyhole size={21} aria-hidden="true" />
          </div>
          <p className="mt-5 text-[11px] font-bold text-main-brown/55">FORMONA ADMIN</p>
          <h1 className="mt-2 text-2xl font-bold leading-tight">관리자 접근</h1>
          <p className="mt-2 text-sm leading-relaxed text-sub-gray">
            측정 수치 확인을 위해 데모 관리자 비밀번호를 입력해주세요.
          </p>

          <label htmlFor="admin-passcode" className="mt-6 block text-xs font-bold text-sub-gray">
            비밀번호
          </label>
          <input
            id="admin-passcode"
            type="password"
            value={passcode}
            onChange={(event) => {
              setPasscode(event.target.value);
              if (authError) setAuthError('');
            }}
            autoComplete="current-password"
            disabled={authStatus === 'checking' || recordsLoading}
            aria-invalid={authError ? 'true' : 'false'}
            aria-describedby={authError ? 'admin-passcode-error' : undefined}
            className="mt-2 h-12 w-full rounded-lg border border-main-brown/20 bg-white px-3 text-base font-bold text-main-brown outline-none transition focus:border-main-brown"
          />
          {authError && (
            <p id="admin-passcode-error" className="mt-2 text-xs font-bold text-red-600">
              {authError}
            </p>
          )}
          <button
            type="submit"
            disabled={authStatus === 'checking' || recordsLoading}
            className="btn btn-primary mt-5 h-12 w-full rounded-lg text-sm"
          >
            {authStatus === 'checking' || recordsLoading ? '확인 중' : '접속'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-y-auto bg-white px-4 py-6 text-main-brown sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-main-brown/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold text-main-brown/55">FORMONA ADMIN</p>
            <h1 className="mt-2 text-2xl font-bold leading-tight">사용자 측정 수치</h1>
            <p className="mt-2 text-sm leading-relaxed text-sub-gray">
              저장된 얼굴형 분석과 눈썹 기준 수치를 제형틀 제작용으로 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={refreshRecords} disabled={recordsLoading} className="btn btn-subtle min-h-11 rounded-lg px-4 text-[13px]">
              <RefreshCw size={15} className={recordsLoading ? 'animate-spin' : undefined} aria-hidden="true" />
              {recordsLoading ? '불러오는 중' : '새로고침'}
            </button>
            <button type="button" onClick={handleDownloadCsv} disabled={records.length === 0} className="btn btn-secondary min-h-11 rounded-lg px-4 text-[13px]">
              <Download size={15} aria-hidden="true" />
              CSV
            </button>
            <button type="button" onClick={handleDownloadJson} disabled={records.length === 0} className="btn btn-primary min-h-11 rounded-lg px-4 text-[13px]">
              <Download size={15} aria-hidden="true" />
              JSON
            </button>
            <button type="button" onClick={handleLogout} className="btn btn-subtle min-h-11 rounded-lg px-4 text-[13px]">
              <LogOut size={15} aria-hidden="true" />
              로그아웃
            </button>
          </div>
        </header>

        {recordsError && (
          <section className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {recordsError}
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-3" aria-label="측정 기록 요약">
          <div className="rounded-lg border border-main-brown/10 bg-main-brown/[0.03] p-4">
            <p className="text-xs font-bold text-sub-gray">총 측정 건수</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{records.length}</p>
          </div>
          <div className="rounded-lg border border-main-brown/10 bg-main-brown/[0.03] p-4">
            <p className="text-xs font-bold text-sub-gray">제작 가능 품질</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{reportableCount}</p>
          </div>
          <div className="rounded-lg border border-main-brown/10 bg-main-brown/[0.03] p-4">
            <p className="text-xs font-bold text-sub-gray">최근 측정</p>
            <p className="mt-2 text-sm font-bold">{latestRecord ? formatDateTime(latestRecord.savedAtIso) : '-'}</p>
          </div>
        </section>

        {records.length === 0 ? (
          <section className="rounded-lg border border-main-brown/10 bg-white p-8 text-center">
            <h2 className="text-lg font-bold">저장된 측정 기록이 없습니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-sub-gray">
              앱에서 얼굴 분석을 완료하면 DB에 저장된 측정값이 이 관리자 화면에 표시됩니다.
            </p>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <section className="overflow-hidden rounded-lg border border-main-brown/10 bg-white" aria-labelledby="record-list-heading">
              <div className="flex items-center justify-between border-b border-main-brown/10 px-4 py-3">
                <h2 id="record-list-heading" className="text-sm font-bold">측정 목록</h2>
                <span className="text-xs font-bold text-sub-gray">최신순</span>
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                {records.map((record, index) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => setSelectedRecordId(record.id)}
                    className={[
                      'grid w-full grid-cols-[72px_minmax(0,1fr)_92px] items-center gap-3 border-b border-main-brown/10 px-4 py-3 text-left last:border-0',
                      selectedRecord?.id === record.id ? 'bg-main-brown/[0.04]' : 'bg-white',
                    ].join(' ')}
                  >
                    <span className="text-xs font-bold text-main-brown">#{String(records.length - index).padStart(3, '0')}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{record.payload.faceShape}</span>
                      <span className="mt-1 block truncate text-xs text-sub-gray">
                        {record.payload.selectedStyle?.name ?? '추천 스타일 없음'} · {formatDateTime(record.payload.measuredAtIso)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular-nums">{record.payload.ipdMm.toFixed(1)}mm</span>
                      <span className="mt-1 block text-[10px] font-bold text-sub-gray">
                        {record.payload.quality.reportable ? '제작 가능' : '검토 필요'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {selectedRecord && (
              <section className="space-y-4" aria-labelledby="record-detail-heading">
                <div className="rounded-lg border border-main-brown/10 bg-white p-5">
                  <p className="text-[11px] font-bold text-main-brown/55">선택 기록</p>
                  <h2 id="record-detail-heading" className="mt-2 text-xl font-bold">{selectedRecord.payload.faceShape}</h2>
                  <p className="mt-1 text-sm text-sub-gray">{selectedRecord.payload.selectedStyle?.name ?? '추천 스타일 없음'}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-main-brown/[0.03] p-3">
                      <p className="text-[11px] font-bold text-sub-gray">측정 시각</p>
                      <p className="mt-1 font-bold">{formatDateTime(selectedRecord.payload.measuredAtIso)}</p>
                    </div>
                    <div className="rounded-lg bg-main-brown/[0.03] p-3">
                      <p className="text-[11px] font-bold text-sub-gray">품질</p>
                      <p className="mt-1 font-bold">{selectedRecord.payload.quality.reportable ? '제작 가능' : '검토 필요'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-main-brown/10 bg-white p-5">
                  <h3 className="text-sm font-bold">눈썹 기준 수치</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {selectedRecord.payload.metrics.map((metric) => (
                      <div key={metric.key} className="rounded-lg bg-main-brown/[0.03] p-3">
                        <p className="text-[11px] font-bold leading-tight text-sub-gray">{metric.label}</p>
                        <p className="mt-2 text-xl font-bold tabular-nums">{metric.displayValue}</p>
                        <p className="mt-1 text-[10px] font-bold text-sub-gray">
                          {metric.reportable ? '사용 가능' : '검토 필요'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-main-brown/10 bg-white p-5">
                  <h3 className="text-sm font-bold">제형틀 가이드 평균</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    {[
                      ['SP 라인', selectedRecord.payload.goldenRatioGuides.average.spLineMm],
                      ['HP 라인', selectedRecord.payload.goldenRatioGuides.average.hpLineMm],
                      ['EP 라인', selectedRecord.payload.goldenRatioGuides.average.epLineMm],
                      ['SP~HP', selectedRecord.payload.goldenRatioGuides.average.spToHpMm],
                      ['HP~EP', selectedRecord.payload.goldenRatioGuides.average.hpToEpMm],
                      ['HP 높이', selectedRecord.payload.goldenRatioGuides.average.hpHeightMm],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between rounded-lg bg-main-brown/[0.03] px-3 py-2">
                        <span className="font-bold text-sub-gray">{label}</span>
                        <span className="font-bold tabular-nums">{Number(value).toFixed(1)}mm</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
