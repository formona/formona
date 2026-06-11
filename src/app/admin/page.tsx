"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import {
  MEASUREMENT_RECORD_STORAGE_KEY,
  parseMeasurementRecords,
  type StoredMeasurementRecord,
} from '../../domain/measurement-records';
import { EYEBROW_METRIC_DISPLAY_ROWS } from '../../domain/measurement-copy';

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
  const [records, setRecords] = useState<StoredMeasurementRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const refreshRecords = useCallback(() => {
    const nextRecords = parseMeasurementRecords(localStorage.getItem(MEASUREMENT_RECORD_STORAGE_KEY));
    setRecords(nextRecords);
    setSelectedRecordId((currentId) => (
      currentId && nextRecords.some((record) => record.id === currentId)
        ? currentId
        : nextRecords[0]?.id ?? null
    ));
  }, []);

  useEffect(() => {
    refreshRecords();
  }, [refreshRecords]);

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
            <button type="button" onClick={refreshRecords} className="btn btn-subtle min-h-11 rounded-lg px-4 text-[13px]">
              <RefreshCw size={15} aria-hidden="true" />
              새로고침
            </button>
            <button type="button" onClick={handleDownloadCsv} disabled={records.length === 0} className="btn btn-secondary min-h-11 rounded-lg px-4 text-[13px]">
              <Download size={15} aria-hidden="true" />
              CSV
            </button>
            <button type="button" onClick={handleDownloadJson} disabled={records.length === 0} className="btn btn-primary min-h-11 rounded-lg px-4 text-[13px]">
              <Download size={15} aria-hidden="true" />
              JSON
            </button>
          </div>
        </header>

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
              앱에서 얼굴 분석을 완료하면 이 브라우저의 관리자 화면에 측정값이 누적됩니다.
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
