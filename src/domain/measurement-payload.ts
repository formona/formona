import { EYEBROW_METRIC_DISPLAY_ROWS } from './measurement-copy';
import type {
  EyebrowMetricKey,
  EyebrowStyle,
  FaceAnalysisResult,
  FaceShape,
} from './types';

export interface MeasurementPayloadMetric {
  key: EyebrowMetricKey;
  label: string;
  description: string;
  valueMm: number;
  displayValue: string;
  reportable: boolean;
  confidence: number | null;
  estimatedErrorMm: number | null;
}

export interface MeasurementPayloadPoint {
  normalized: { x: number; y: number };
  pixel: { x: number; y: number } | null;
  mmFromFrameOrigin: { x: number; y: number } | null;
  source?: string;
}

export interface MeasurementPayloadGuideLine {
  start: MeasurementPayloadPoint;
  end: MeasurementPayloadPoint;
  lengthMm: number;
}

export interface MeasurementPayloadGoldenRatioSide {
  anchors: {
    sp: MeasurementPayloadPoint;
    hp: MeasurementPayloadPoint;
    ep: MeasurementPayloadPoint;
    goldenRatioTarget: MeasurementPayloadPoint | null;
  };
  lines: {
    sp: MeasurementPayloadGuideLine;
    hp: MeasurementPayloadGuideLine;
    ep: MeasurementPayloadGuideLine;
  } | null;
  distancesMm: {
    spToHp: number;
    hpToEp: number;
    spToEp: number;
    hpHeight: number;
  };
  hpPositionRatio: number;
  actualGoldenRatio: number;
}

export interface MeasurementDataPayload {
  schemaVersion: 'formona.measurement.v1';
  measuredAtIso: string;
  faceShape: FaceShape;
  selectedStyle: {
    id: string;
    name: string;
  } | null;
  ipdMm: number;
  pxToMmScale: number;
  pupilIpd: {
    source: FaceAnalysisResult['pupilIpd']['source'];
    ipdPx: number | null;
    normalizedIpd: number;
    confidence: number;
  };
  metrics: MeasurementPayloadMetric[];
  goldenRatioGuides: {
    left: MeasurementPayloadGoldenRatioSide;
    right: MeasurementPayloadGoldenRatioSide;
    average: {
      spLineMm: number;
      hpLineMm: number;
      epLineMm: number;
      spToHpMm: number;
      hpToEpMm: number;
      spToEpMm: number;
      hpHeightMm: number;
      hpPositionRatio: number;
      actualGoldenRatio: number;
    };
  };
  overlayAnchors: {
    left: {
      sp: { x: number; y: number };
      hp: { x: number; y: number; source?: string };
      ep: { x: number; y: number };
    };
    right: {
      sp: { x: number; y: number };
      hp: { x: number; y: number; source?: string };
      ep: { x: number; y: number };
    };
    confidence: number;
  };
  quality: {
    overallConfidence: number | null;
    maxEstimatedErrorMm: number | null;
    reportable: boolean;
    alignmentReady: boolean;
  };
}

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

const roundCoordinate = (value: number) => Math.round(value * 10_000) / 10_000;

const anchorPoint = <T extends { x: number; y: number; source?: string }>(point: T) => ({
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y),
  ...('source' in point && point.source ? { source: point.source } : {}),
});

const measurementPoint = (
  point: { x: number; y: number; source?: string },
  analysis: FaceAnalysisResult,
): MeasurementPayloadPoint => {
  const pixel = analysis.videoDimensions
    ? {
      x: roundCoordinate(point.x * analysis.videoDimensions.width),
      y: roundCoordinate(point.y * analysis.videoDimensions.height),
    }
    : null;
  const mmFromFrameOrigin = pixel
    ? {
      x: roundToTenth(pixel.x * analysis.pxToMmScale),
      y: roundToTenth(pixel.y * analysis.pxToMmScale),
    }
    : null;

  return {
    normalized: {
      x: roundCoordinate(point.x),
      y: roundCoordinate(point.y),
    },
    pixel,
    mmFromFrameOrigin,
    ...('source' in point && point.source ? { source: point.source } : {}),
  };
};

const guideLinePayload = (
  start: { x: number; y: number; source?: string },
  end: { x: number; y: number; source?: string },
  lengthMm: number,
  analysis: FaceAnalysisResult,
): MeasurementPayloadGuideLine => ({
  start: measurementPoint(start, analysis),
  end: measurementPoint(end, analysis),
  lengthMm: roundToTenth(lengthMm),
});

const emptyGoldenRatioMeasurements = (): FaceAnalysisResult['goldenRatioMeasurements']['left'] => ({
  spLineMm: 0,
  hpLineMm: 0,
  epLineMm: 0,
  spToHpMm: 0,
  hpToEpMm: 0,
  spToEpMm: 0,
  hpHeightMm: 0,
  hpPositionRatio: 0,
  actualGoldenRatio: 0,
});

const goldenRatioSidePayload = (
  side: FaceAnalysisResult['overlayAnchors']['left'],
  measurements: FaceAnalysisResult['goldenRatioMeasurements']['left'] | undefined,
  analysis: FaceAnalysisResult,
): MeasurementPayloadGoldenRatioSide => {
  const resolvedMeasurements = measurements ?? emptyGoldenRatioMeasurements();

  return {
    anchors: {
      sp: measurementPoint(side.sp, analysis),
      hp: measurementPoint(side.hp, analysis),
      ep: measurementPoint(side.ep, analysis),
      goldenRatioTarget: side.guides?.goldenRatioTarget
        ? measurementPoint(side.guides.goldenRatioTarget, analysis)
        : null,
    },
    lines: side.guides
      ? {
        sp: guideLinePayload(side.guides.spLine.start, side.guides.spLine.end, resolvedMeasurements.spLineMm, analysis),
        hp: guideLinePayload(side.guides.hpLine.start, side.guides.hpLine.end, resolvedMeasurements.hpLineMm, analysis),
        ep: guideLinePayload(side.guides.epLine.start, side.guides.epLine.end, resolvedMeasurements.epLineMm, analysis),
      }
      : null,
    distancesMm: {
      spToHp: roundToTenth(resolvedMeasurements.spToHpMm),
      hpToEp: roundToTenth(resolvedMeasurements.hpToEpMm),
      spToEp: roundToTenth(resolvedMeasurements.spToEpMm),
      hpHeight: roundToTenth(resolvedMeasurements.hpHeightMm),
    },
    hpPositionRatio: roundCoordinate(resolvedMeasurements.hpPositionRatio),
    actualGoldenRatio: roundCoordinate(resolvedMeasurements.actualGoldenRatio),
  };
};

export const buildMeasurementDataPayload = ({
  analysis,
  selectedStyle = null,
  measuredAtIso = new Date().toISOString(),
}: {
  analysis: FaceAnalysisResult;
  selectedStyle?: EyebrowStyle | null;
  measuredAtIso?: string;
}): MeasurementDataPayload => ({
  schemaVersion: 'formona.measurement.v1',
  measuredAtIso,
  faceShape: analysis.faceShape,
  selectedStyle: selectedStyle
    ? {
      id: selectedStyle.id,
      name: selectedStyle.name,
    }
    : null,
  ipdMm: roundToTenth(analysis.ipdMm),
  pxToMmScale: analysis.pxToMmScale,
  pupilIpd: {
    source: analysis.pupilIpd.source,
    ipdPx: analysis.pupilIpd.ipdPx,
    normalizedIpd: analysis.pupilIpd.normalizedIpd,
    confidence: analysis.pupilIpd.confidence,
  },
  metrics: EYEBROW_METRIC_DISPLAY_ROWS.map((row) => {
    const confidence = analysis.metricConfidence?.metrics[row.key];
    const valueMm = roundToTenth(analysis.metrics[row.key]);

    return {
      key: row.key,
      label: row.label,
      description: row.description,
      valueMm,
      displayValue: `${valueMm.toFixed(1)}mm`,
      reportable: confidence?.reportable ?? analysis.metricConfidence?.reportable ?? true,
      confidence: confidence?.confidence ?? null,
      estimatedErrorMm: confidence?.estimatedErrorMm ?? null,
    };
  }),
  goldenRatioGuides: {
    left: goldenRatioSidePayload(analysis.overlayAnchors.left, analysis.goldenRatioMeasurements?.left, analysis),
    right: goldenRatioSidePayload(analysis.overlayAnchors.right, analysis.goldenRatioMeasurements?.right, analysis),
    average: {
      spLineMm: roundToTenth((analysis.goldenRatioMeasurements?.average ?? emptyGoldenRatioMeasurements()).spLineMm),
      hpLineMm: roundToTenth((analysis.goldenRatioMeasurements?.average ?? emptyGoldenRatioMeasurements()).hpLineMm),
      epLineMm: roundToTenth((analysis.goldenRatioMeasurements?.average ?? emptyGoldenRatioMeasurements()).epLineMm),
      spToHpMm: roundToTenth((analysis.goldenRatioMeasurements?.average ?? emptyGoldenRatioMeasurements()).spToHpMm),
      hpToEpMm: roundToTenth((analysis.goldenRatioMeasurements?.average ?? emptyGoldenRatioMeasurements()).hpToEpMm),
      spToEpMm: roundToTenth((analysis.goldenRatioMeasurements?.average ?? emptyGoldenRatioMeasurements()).spToEpMm),
      hpHeightMm: roundToTenth((analysis.goldenRatioMeasurements?.average ?? emptyGoldenRatioMeasurements()).hpHeightMm),
      hpPositionRatio: roundCoordinate((analysis.goldenRatioMeasurements?.average ?? emptyGoldenRatioMeasurements()).hpPositionRatio),
      actualGoldenRatio: roundCoordinate((analysis.goldenRatioMeasurements?.average ?? emptyGoldenRatioMeasurements()).actualGoldenRatio),
    },
  },
  overlayAnchors: {
    left: {
      sp: anchorPoint(analysis.overlayAnchors.left.sp),
      hp: anchorPoint(analysis.overlayAnchors.left.hp),
      ep: anchorPoint(analysis.overlayAnchors.left.ep),
    },
    right: {
      sp: anchorPoint(analysis.overlayAnchors.right.sp),
      hp: anchorPoint(analysis.overlayAnchors.right.hp),
      ep: anchorPoint(analysis.overlayAnchors.right.ep),
    },
    confidence: analysis.overlayAnchors.confidence,
  },
  quality: {
    overallConfidence: analysis.metricConfidence?.overallConfidence ?? null,
    maxEstimatedErrorMm: analysis.metricConfidence?.maxEstimatedErrorMm ?? null,
    reportable: analysis.metricConfidence?.reportable ?? true,
    alignmentReady: Boolean(analysis.alignment.ready),
  },
});
