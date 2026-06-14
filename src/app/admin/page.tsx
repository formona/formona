"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, Eye, EyeOff, LockKeyhole, LogOut, RefreshCw } from 'lucide-react';
import {
  parseOrderRecords,
  type StoredOrderRecord,
} from '../../domain/order-records';
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

  return parseOrderRecords(JSON.stringify((value as { records: unknown }).records));
};

const buildRecordsCsv = (records: StoredOrderRecord[]) => {
  const metricHeaders = EYEBROW_METRIC_DISPLAY_ROWS.map((row) => `${row.label}(mm)`);
  const headers = [
    'orderId',
    'orderedAtIso',
    'measurementRecordId',
    'measuredAtIso',
    'recipient',
    'phone',
    'postalCode',
    'baseAddress',
    'detailAddress',
    'deliveryMemo',
    'faceShape',
    'selectedStyle',
    'ipdMm',
    'qualityReportable',
    'overallConfidence',
    'maxEstimatedErrorMm',
    ...metricHeaders,
  ];

  const rows = records.map((record) => {
    const measurement = record.payload.measurement;
    const shippingAddress = record.payload.shippingAddress;
    const metricValues = EYEBROW_METRIC_DISPLAY_ROWS.map((row) => (
      measurement.metrics.find((metric) => metric.key === row.key)?.valueMm ?? ''
    ));

    return [
      record.id,
      record.orderedAtIso,
      record.measurementRecordId,
      measurement.measuredAtIso,
      shippingAddress.recipient,
      shippingAddress.phone,
      shippingAddress.postalCode,
      shippingAddress.baseAddress,
      shippingAddress.detailAddress,
      shippingAddress.deliveryMemo,
      measurement.faceShape,
      measurement.selectedStyle?.name ?? '',
      measurement.ipdMm,
      measurement.quality.reportable,
      measurement.quality.overallConfidence ?? '',
      measurement.quality.maxEstimatedErrorMm ?? '',
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
  const [isPasscodeVisible, setIsPasscodeVisible] = useState(false);
  const [authError, setAuthError] = useState('');
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [records, setRecords] = useState<StoredOrderRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const applyRecords = useCallback((nextRecords: StoredOrderRecord[]) => {
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
      const response = await fetch('/api/admin/orders', {
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
        throw new Error(`Admin orders request failed: ${response.status}`);
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
      setRecordsError('주문 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
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
  const reportableCount = records.filter((record) => record.payload.measurement.quality.reportable).length;
  const latestRecord = records[0] ?? null;

  const handleDownloadJson = () => {
    downloadTextFile(
      `formona-orders-${Date.now()}.json`,
      JSON.stringify(records, null, 2),
      'application/json;charset=utf-8',
    );
  };

  const handleDownloadCsv = () => {
    downloadTextFile(
      `formona-orders-${Date.now()}.csv`,
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
    setIsPasscodeVisible(false);
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
            주문과 배송지 확인을 위해 관리자 비밀번호를 입력해주세요.
          </p>

          <label htmlFor="admin-passcode" className="mt-6 block text-xs font-bold text-sub-gray">
            비밀번호
          </label>
          <div className="relative mt-2">
            <input
              id="admin-passcode"
              type={isPasscodeVisible ? 'text' : 'password'}
              value={passcode}
              onChange={(event) => {
                setPasscode(event.target.value);
                if (authError) setAuthError('');
              }}
              autoComplete="current-password"
              disabled={authStatus === 'checking' || recordsLoading}
              aria-invalid={authError ? 'true' : 'false'}
              aria-describedby={authError ? 'admin-passcode-error' : undefined}
              className="h-12 w-full rounded-lg border border-main-brown/20 bg-white px-3 pr-12 text-base font-bold text-main-brown outline-none transition focus:border-main-brown"
            />
            <button
              type="button"
              onClick={() => setIsPasscodeVisible((current) => !current)}
              disabled={authStatus === 'checking' || recordsLoading}
              aria-label={isPasscodeVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
              title={isPasscodeVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-main-brown/65 transition hover:bg-main-brown/[0.06] hover:text-main-brown focus-visible:outline focus-visible:outline-3 focus-visible:outline-main-brown/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isPasscodeVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
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
            <h1 className="mt-2 text-2xl font-bold leading-tight">주문 및 측정 정보</h1>
            <p className="mt-2 text-sm leading-relaxed text-sub-gray">
              주문 완료된 배송지와 얼굴형 분석, 눈썹 기준 수치를 함께 확인합니다.
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

        <section className="grid gap-3 sm:grid-cols-3" aria-label="주문 기록 요약">
          <div className="rounded-lg border border-main-brown/10 bg-main-brown/[0.03] p-4">
            <p className="text-xs font-bold text-sub-gray">총 주문 건수</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{records.length}</p>
          </div>
          <div className="rounded-lg border border-main-brown/10 bg-main-brown/[0.03] p-4">
            <p className="text-xs font-bold text-sub-gray">제작 가능 주문</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{reportableCount}</p>
          </div>
          <div className="rounded-lg border border-main-brown/10 bg-main-brown/[0.03] p-4">
            <p className="text-xs font-bold text-sub-gray">최근 주문</p>
            <p className="mt-2 text-sm font-bold">{latestRecord ? formatDateTime(latestRecord.orderedAtIso) : '-'}</p>
          </div>
        </section>

        {records.length === 0 ? (
          <section className="rounded-lg border border-main-brown/10 bg-white p-8 text-center">
            <h2 className="text-lg font-bold">저장된 주문 기록이 없습니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-sub-gray">
              앱에서 주문 완료를 누르면 DB에 저장된 주문과 측정값이 이 관리자 화면에 표시됩니다.
            </p>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <section className="overflow-hidden rounded-lg border border-main-brown/10 bg-white" aria-labelledby="record-list-heading">
              <div className="flex items-center justify-between border-b border-main-brown/10 px-4 py-3">
                <h2 id="record-list-heading" className="text-sm font-bold">주문 목록</h2>
                <span className="text-xs font-bold text-sub-gray">최신순</span>
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                {records.map((record, index) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => setSelectedRecordId(record.id)}
                    className={[
                      'grid w-full grid-cols-[72px_minmax(0,1fr)_104px] items-center gap-3 border-b border-main-brown/10 px-4 py-3 text-left last:border-0',
                      selectedRecord?.id === record.id ? 'bg-main-brown/[0.04]' : 'bg-white',
                    ].join(' ')}
                  >
                    <span className="text-xs font-bold text-main-brown">#{String(records.length - index).padStart(3, '0')}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{record.payload.shippingAddress.recipient}</span>
                      <span className="mt-1 block truncate text-xs text-sub-gray">
                        {record.payload.measurement.selectedStyle?.name ?? '추천 스타일 없음'} · {formatDateTime(record.orderedAtIso)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block truncate text-sm font-bold">{record.payload.measurement.faceShape}</span>
                      <span className="mt-1 block text-[10px] font-bold text-sub-gray">
                        {record.payload.measurement.quality.reportable ? '제작 가능' : '검토 필요'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {selectedRecord && (
              <section className="space-y-4" aria-labelledby="record-detail-heading">
                <div className="rounded-lg border border-main-brown/10 bg-white p-5">
                  <p className="text-[11px] font-bold text-main-brown/55">선택 주문</p>
                  <h2 id="record-detail-heading" className="mt-2 text-xl font-bold">{selectedRecord.payload.shippingAddress.recipient}</h2>
                  <p className="mt-1 text-sm text-sub-gray">
                    {selectedRecord.payload.measurement.selectedStyle?.name ?? '추천 스타일 없음'} · {selectedRecord.payload.measurement.faceShape}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-main-brown/[0.03] p-3">
                      <p className="text-[11px] font-bold text-sub-gray">주문 시각</p>
                      <p className="mt-1 font-bold">{formatDateTime(selectedRecord.orderedAtIso)}</p>
                    </div>
                    <div className="rounded-lg bg-main-brown/[0.03] p-3">
                      <p className="text-[11px] font-bold text-sub-gray">품질</p>
                      <p className="mt-1 font-bold">{selectedRecord.payload.measurement.quality.reportable ? '제작 가능' : '검토 필요'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-main-brown/10 bg-white p-5">
                  <h3 className="text-sm font-bold">배송지 정보</h3>
                  <div className="mt-4 space-y-2 text-sm">
                    {[
                      ['연락처', selectedRecord.payload.shippingAddress.phone],
                      ['우편번호', selectedRecord.payload.shippingAddress.postalCode],
                      ['기본 주소', selectedRecord.payload.shippingAddress.baseAddress],
                      ['상세 주소', selectedRecord.payload.shippingAddress.detailAddress],
                      ['배송 메모', selectedRecord.payload.shippingAddress.deliveryMemo],
                    ].map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-lg bg-main-brown/[0.03] px-3 py-2">
                        <span className="font-bold text-sub-gray">{label}</span>
                        <span className="break-keep font-bold">{value || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-main-brown/10 bg-white p-5">
                  <h3 className="text-sm font-bold">눈썹 기준 수치</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {selectedRecord.payload.measurement.metrics.map((metric) => (
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
                      ['SP 라인', selectedRecord.payload.measurement.goldenRatioGuides.average.spLineMm],
                      ['HP 라인', selectedRecord.payload.measurement.goldenRatioGuides.average.hpLineMm],
                      ['EP 라인', selectedRecord.payload.measurement.goldenRatioGuides.average.epLineMm],
                      ['SP~HP', selectedRecord.payload.measurement.goldenRatioGuides.average.spToHpMm],
                      ['HP~EP', selectedRecord.payload.measurement.goldenRatioGuides.average.hpToEpMm],
                      ['HP 높이', selectedRecord.payload.measurement.goldenRatioGuides.average.hpHeightMm],
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
