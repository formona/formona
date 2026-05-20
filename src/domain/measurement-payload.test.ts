import { describe, expect, it } from 'vitest';

import { analyzeFaceLandmarks } from './face-analysis';
import { EYEBROW_METRIC_FIXTURES } from './eyebrow-metric-fixtures';
import { EYEBROW_METRIC_DISPLAY_ROWS } from './measurement-copy';
import { buildMeasurementDataPayload } from './measurement-payload';

describe('measurement data payload', () => {
  it('serializes the seven reportable eyebrow metrics and golden-ratio anchors without raw images or landmarks', () => {
    const fixture = EYEBROW_METRIC_FIXTURES[0];
    const analysis = analyzeFaceLandmarks(fixture.landmarks, fixture.ipdMm, fixture.dimensions);

    expect(analysis).not.toBeNull();

    const payload = buildMeasurementDataPayload({
      analysis: analysis!,
      selectedStyle: {
        id: 'natural_arch',
        name: '자연 아치형',
        description: '',
        path: 'M10,20 Q50,10 90,20',
      },
      measuredAtIso: '2026-05-15T00:00:00.000Z',
    });
    const serialized = JSON.stringify(payload);

    expect(payload).toMatchObject({
      schemaVersion: 'formona.measurement.v1',
      measuredAtIso: '2026-05-15T00:00:00.000Z',
      selectedStyle: {
        id: 'natural_arch',
        name: '자연 아치형',
      },
      pupilIpd: {
        source: 'iris',
      },
      quality: {
        reportable: true,
        alignmentReady: true,
      },
    });
    expect(payload.metrics).toHaveLength(EYEBROW_METRIC_DISPLAY_ROWS.length);
    EYEBROW_METRIC_DISPLAY_ROWS.forEach((row, index) => {
      expect(payload.metrics[index]).toMatchObject({
        key: row.key,
        label: row.label,
        description: row.description,
        displayValue: `${analysis!.metrics[row.key].toFixed(1)}mm`,
        reportable: true,
      });
    });
    expect(payload.overlayAnchors.left).toMatchObject({
      sp: { x: expect.any(Number), y: expect.any(Number) },
      hp: { x: expect.any(Number), y: expect.any(Number), source: 'iris' },
      ep: { x: expect.any(Number), y: expect.any(Number) },
    });
    expect(payload.goldenRatioGuides.left.lines?.sp).toMatchObject({
      start: { normalized: { x: 0.44, y: 0.57 } },
      end: { normalized: { x: 0.44, y: 0.35 } },
      lengthMm: analysis!.metrics.sp,
    });
    expect(payload.goldenRatioGuides.left.lines?.hp).toMatchObject({
      start: { source: 'iris' },
      end: { source: 'iris' },
      lengthMm: analysis!.metrics.hp,
    });
    expect(payload.goldenRatioGuides.left.lines?.ep.start.normalized).toMatchObject({ x: 0.5, y: 0.644 });
    expect(payload.goldenRatioGuides.average.spLineMm).toBe(analysis!.metrics.sp);
    expect(serialized).not.toContain('rawLandmarks');
    expect(serialized).not.toContain('landmarks');
    expect(serialized).not.toContain('data:image');
  });
});
