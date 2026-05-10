import type { EyebrowMetricKey, MeasurementDisplayItem } from './types';

export const EYEBROW_METRIC_DISPLAY_ROWS = [
  { key: 'sp', label: '눈썹 시작점 (SP)', description: '콧볼 수직선 기준' },
  { key: 'hp', label: '눈썹 최고점 (HP)', description: '홍채 중심 수직선 기준' },
  { key: 'ep', label: '눈썹 끝점 (EP)', description: '인중~눈꼬리 대각선 기준' },
  { key: 'totalLength', label: '눈썹 전체 길이', description: 'SP ~ EP 직선 거리' },
  { key: 'thickness', label: '눈썹 두께', description: '가장 두꺼운 지점' },
  { key: 'archHeight', label: '아치 높이', description: '기준선~HP 수직 거리' },
  { key: 'gap', label: '눈썹 간격', description: '좌우 눈썹 SP 사이 거리' },
] as const satisfies readonly {
  key: EyebrowMetricKey;
  label: string;
  description: string;
}[];

export const EYEBROW_METRIC_DISPLAY_KEYS = EYEBROW_METRIC_DISPLAY_ROWS.map((row) => row.key);

export const EYEBROW_METRIC_DISPLAY_COPY: Record<
  EyebrowMetricKey,
  Pick<MeasurementDisplayItem, 'label' | 'description'>
> = EYEBROW_METRIC_DISPLAY_ROWS.reduce((copy, row) => {
  copy[row.key] = {
    label: row.label,
    description: row.description,
  };
  return copy;
}, {} as Record<EyebrowMetricKey, Pick<MeasurementDisplayItem, 'label' | 'description'>>);
