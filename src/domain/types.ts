export enum FaceShape {
  OVAL = '계란형',
  SQUARE = '각형',
  ROUND = '둥근형',
  HEART = '하트형',
}

export type CameraPermissionState = 'idle' | 'pending' | 'granted' | 'denied' | 'unavailable';

export interface EyebrowStyle {
  id: string;
  name: string;
  description: string;
  path: string;
}

export interface FaceShapeResultCopy {
  title: string;
  description: string;
  insight: string;
  recommendationExplanation: string;
}

export interface MeasurementDisplayItem {
  label: string;
  value: string;
  description?: string;
  confidence?: EyebrowMetricConfidence;
}

export interface EyebrowRecommendationSet {
  faceShape: FaceShape;
  styles: EyebrowStyle[];
}

export interface EyebrowRecommendationContext {
  faceShape: FaceShape;
  normalizedGeometry: NormalizedFaceGeometry;
  metrics: EyebrowMetrics;
  metricConfidence?: EyebrowMetricConfidenceModel;
  eyebrowPosition: EyebrowPositionMetrics;
  eyeGeometry: EyeGeometryMetrics;
  overlayAnchors?: EyebrowOverlayAnchors;
  ipdMm: number;
  pxToMmScale: number;
}

export type EyebrowRecommendationValidationReason =
  | 'missing_analysis'
  | 'missing_metrics'
  | 'invalid_metrics'
  | 'missing_geometry'
  | 'missing_scale'
  | 'low_confidence';

export interface EyebrowRecommendationValidationResult {
  valid: boolean;
  reason: EyebrowRecommendationValidationReason | null;
  title: string;
  message: string;
}

export type EyebrowRecommendationGenerationState =
  | {
    status: 'loading';
    validation: EyebrowRecommendationValidationResult;
    context: null;
    recommendations: [];
  }
  | {
    status: 'error';
    validation: EyebrowRecommendationValidationResult;
    context: null;
    recommendations: [];
  }
  | {
    status: 'ready';
    validation: EyebrowRecommendationValidationResult;
    context: EyebrowRecommendationContext;
    recommendations: EyebrowStyle[];
  };

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

export interface FacePoint extends NormalizedLandmark {}

export type NormalizedLandmarkList = readonly NormalizedLandmark[];
export type FaceMeshLandmarkList = readonly FacePoint[];

export interface VideoDimensions {
  width: number;
  height: number;
}

export interface PupilIpdMeasurement {
  leftPupil: FacePoint;
  rightPupil: FacePoint;
  leftPupilPx: FacePoint | null;
  rightPupilPx: FacePoint | null;
  ipdPx: number | null;
  normalizedIpd: number;
  source: 'iris' | 'eye-center';
  confidence: number;
}

export interface FaceRelativeAxis {
  x: number;
  y: number;
}

export interface FaceRelativePoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

export interface FaceRelativeCoordinateSpace {
  origin: FacePoint;
  scale: number;
  xAxis: FaceRelativeAxis;
  yAxis: FaceRelativeAxis;
  rotationRadians: number;
  rotationDegrees: number;
  confidence: number;
  landmarks: FaceRelativePoint[];
}

export interface BrowLandmarkGroup {
  inner: FacePoint | null;
  arch: FacePoint | null;
  outer: FacePoint | null;
  points: FacePoint[];
  confidence: number;
}

export interface EyeLandmarkGroup {
  outer: FacePoint | null;
  inner: FacePoint | null;
  top: FacePoint | null;
  bottom: FacePoint | null;
  center: FacePoint | null;
  points: FacePoint[];
  confidence: number;
}

export interface IrisLandmarkGroup {
  center: FacePoint | null;
  points: FacePoint[];
  confidence: number;
  complete: boolean;
}

export interface FaceReferenceLandmarks {
  forehead: FacePoint | null;
  chin: FacePoint | null;
  leftForehead: FacePoint | null;
  rightForehead: FacePoint | null;
  leftCheek: FacePoint | null;
  rightCheek: FacePoint | null;
  leftJaw: FacePoint | null;
  rightJaw: FacePoint | null;
  points: FacePoint[];
  confidence: number;
}

export interface ExtractedFaceFeatureLandmarks {
  rawLandmarks: FacePoint[];
  coreLandmarks: FacePoint[];
  hasCoreFaceMesh: boolean;
  hasIrisLandmarks: boolean;
  eyebrows: {
    left: BrowLandmarkGroup;
    right: BrowLandmarkGroup;
  };
  eyes: {
    left: EyeLandmarkGroup;
    right: EyeLandmarkGroup;
  };
  irises: {
    left: IrisLandmarkGroup;
    right: IrisLandmarkGroup;
  };
  faceReference: FaceReferenceLandmarks;
  missingRequiredIndices: number[];
}

export type LandmarkFrameFailureReason =
  | 'missing_face'
  | 'missing_eyebrow_landmarks'
  | 'partial_landmarks'
  | 'low_confidence';

export interface LandmarkFrameValidationResult {
  valid: boolean;
  reason: LandmarkFrameFailureReason | null;
  confidence: number;
  missingRequiredIndices: number[];
  canUseFallback: boolean;
}

export interface LandmarkFrameGuidance {
  reason: LandmarkFrameFailureReason;
  title: string;
  message: string;
}

export type IpdValidationFailureReason =
  | 'missing_landmarks'
  | 'low_confidence'
  | 'implausible_distance';

export interface IpdValidationResult {
  valid: boolean;
  reason: IpdValidationFailureReason | null;
  confidence: number;
}

export interface IpdMeasurementGuidance {
  reason: IpdValidationFailureReason;
  title: string;
  message: string;
}

export interface FaceDimensions {
  faceWidth: number;
  faceHeight: number;
  jawWidth: number;
  cheekWidth: number;
  foreheadWidth: number;
}

export interface NormalizedFaceGeometry {
  faceWidth: number;
  faceHeight: number;
  jawWidth: number;
  cheekWidth: number;
  foreheadWidth: number;
  heightToWidth: number;
  jawToCheek: number;
  foreheadToCheek: number;
  cheekToFaceWidth: number;
}

export interface FaceProportionMetrics {
  faceHeightToWidth: number;
  faceWidthToHeight: number;
  foreheadToFaceWidth: number;
  cheekToFaceWidth: number;
  jawToFaceWidth: number;
  foreheadToCheek: number;
  jawToCheek: number;
  averageBrowToEye: number;
  browToEyeHeight: number;
  browToFaceHeight: number;
  browGapToFaceWidth: number;
  browLengthToFaceWidth: number;
  archHeightToFaceHeight: number;
  eyeHeightToFaceHeight: number;
  eyeWidthToFaceWidth: number;
  interEyeToFaceWidth: number;
  confidence: number;
}

export interface FaceAlignment {
  detected: boolean;
  centered: boolean;
  distanceOk: boolean;
  pitchOk: boolean;
  yawOk: boolean;
  guidance: string;
  confidence: number;
  offsetX?: number;
  offsetY?: number;
  faceHeightRatio?: number;
  faceWidthRatio?: number;
  rollDegrees?: number;
  distanceState?: 'too_far' | 'ok' | 'too_close' | 'unknown';
  horizontalDirection?: 'left' | 'center' | 'right';
  verticalDirection?: 'up' | 'center' | 'down';
  ready?: boolean;
}

export interface EyebrowMetrics {
  sp: number;
  hp: number;
  ep: number;
  totalLength: number;
  thickness: number;
  archHeight: number;
  gap: number;
}

export type EyebrowMetricKey = keyof EyebrowMetrics;

export type EyebrowMetricConfidenceBand = 'target' | 'eligible' | 'ineligible';

export type EyebrowMetricConfidenceReason =
  | 'stable_iris_scale'
  | 'eye_center_scale'
  | 'alignment_stable'
  | 'alignment_unstable'
  | 'landmarks_stable'
  | 'landmarks_unstable'
  | 'asymmetry_detected';

export interface EyebrowMetricConfidence {
  key: EyebrowMetricKey;
  confidence: number;
  estimatedErrorMm: number;
  targetErrorMm: number;
  eligibilityErrorMm: number;
  reportable: boolean;
  band: EyebrowMetricConfidenceBand;
  reasons: EyebrowMetricConfidenceReason[];
}

export interface EyebrowMetricConfidenceModel {
  targetErrorMm: number;
  eligibilityErrorMm: number;
  minReportableConfidence: number;
  highConfidence: number;
  overallConfidence: number;
  maxEstimatedErrorMm: number;
  reportable: boolean;
  metrics: Record<EyebrowMetricKey, EyebrowMetricConfidence>;
}

export type EyebrowMeasurementStabilityState = 'warming' | 'stable' | 'held' | 'reset';

export interface EyebrowMeasurementStability {
  state: EyebrowMeasurementStabilityState;
  sampleCount: number;
  heldForMs: number;
  maxDeltaMm: number;
  smoothingAlpha: number;
}

export interface EyebrowSidePositionMetrics {
  browHeight: number;
  length: number;
  archHeight: number;
  archLocation: number;
  startToPupil: number;
  archToPupil: number;
  endToPupil: number;
}

export interface EyebrowPositionMetrics {
  left: EyebrowSidePositionMetrics;
  right: EyebrowSidePositionMetrics;
  browHeight: number;
  browSpacing: number;
  archHeight: number;
  archLocation: number;
  leftRightSymmetry: number;
  heightAsymmetry: number;
  lengthAsymmetry: number;
  archLocationAsymmetry: number;
  confidence: number;
}

export interface EyeSideGeometryMetrics {
  width: number;
  height: number;
  tiltDegrees: number;
}

export interface EyeGeometryMetrics {
  left: EyeSideGeometryMetrics;
  right: EyeSideGeometryMetrics;
  eyeWidth: number;
  eyeHeight: number;
  eyeTiltDegrees: number;
  interEyeSpacing: number;
  confidence: number;
}

export interface ArEyebrowPath {
  left: string;
  right: string;
  viewBox: string;
  leftFill?: string;
  rightFill?: string;
  strokeWidth?: number;
  styleId?: string;
}

export type EyebrowOverlayAnchorSource = 'iris' | 'eye-center';

export interface EyebrowOverlayAnchorPoint extends FacePoint {
  source?: EyebrowOverlayAnchorSource;
}

export interface EyebrowOverlaySideAnchors {
  sp: EyebrowOverlayAnchorPoint;
  hp: EyebrowOverlayAnchorPoint;
  ep: EyebrowOverlayAnchorPoint;
  confidence: number;
  guides?: EyebrowGoldenRatioSideGuides;
}

export interface EyebrowGoldenRatioGuideLine {
  start: EyebrowOverlayAnchorPoint;
  end: EyebrowOverlayAnchorPoint;
}

export interface EyebrowGoldenRatioSideGuides {
  spLine: EyebrowGoldenRatioGuideLine;
  hpLine: EyebrowGoldenRatioGuideLine;
  epLine: EyebrowGoldenRatioGuideLine;
  goldenRatioTarget: EyebrowOverlayAnchorPoint;
}

export interface EyebrowOverlayTransform {
  origin: FacePoint;
  scale: number;
  rotationRadians: number;
  rotationDegrees: number;
  confidence: number;
}

export interface EyebrowOverlayAnchors {
  left: EyebrowOverlaySideAnchors;
  right: EyebrowOverlaySideAnchors;
  confidence: number;
  transform: EyebrowOverlayTransform;
}

export interface EyebrowGoldenRatioSideMeasurements {
  spLineMm: number;
  hpLineMm: number;
  epLineMm: number;
  spToHpMm: number;
  hpToEpMm: number;
  spToEpMm: number;
  hpHeightMm: number;
  hpPositionRatio: number;
  actualGoldenRatio: number;
}

export interface EyebrowGoldenRatioMeasurements {
  left: EyebrowGoldenRatioSideMeasurements;
  right: EyebrowGoldenRatioSideMeasurements;
  average: EyebrowGoldenRatioSideMeasurements;
}

export interface FaceAnalysisResult {
  faceShape: FaceShape;
  faceDimensions: FaceDimensions;
  normalizedGeometry: NormalizedFaceGeometry;
  proportionMetrics: FaceProportionMetrics;
  faceCoordinateSpace: FaceRelativeCoordinateSpace;
  measurements: MeasurementDisplayItem[];
  metrics: EyebrowMetrics;
  metricConfidence?: EyebrowMetricConfidenceModel;
  eyebrowPosition: EyebrowPositionMetrics;
  eyeGeometry: EyeGeometryMetrics;
  ipdMm: number;
  pupilIpd: PupilIpdMeasurement;
  pxToMmScale: number;
  alignment: FaceAlignment;
  overlayAnchors: EyebrowOverlayAnchors;
  goldenRatioMeasurements: EyebrowGoldenRatioMeasurements;
  overlay: ArEyebrowPath;
  videoDimensions?: VideoDimensions;
  measurementStability?: EyebrowMeasurementStability;
}
