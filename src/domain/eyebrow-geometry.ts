import type {
  ArEyebrowPath,
  EyebrowOverlayAnchors,
  EyebrowOverlaySideAnchors,
  EyebrowStyle,
  FacePoint,
} from './types';

interface BrowStyleProfile {
  archMultiplier: number;
  archOffset: number;
  startLift: number;
  endLift: number;
  thickness: number;
  mode: 'curve' | 'line' | 'angular' | 'round';
}

export type RecommendedEyebrowRenderMode = BrowStyleProfile['mode'];

export interface BrowControlPoints {
  sp: FacePoint;
  hp: FacePoint;
  ep: FacePoint;
  lowerSp: FacePoint;
  lowerHp: FacePoint;
  lowerEp: FacePoint;
}

export interface RecommendedEyebrowControlGeometry {
  left: BrowControlPoints;
  right: BrowControlPoints;
  mode: RecommendedEyebrowRenderMode;
  strokeWidth: number;
  styleId: string;
}

const DEFAULT_PROFILE: BrowStyleProfile = {
  archMultiplier: 1,
  archOffset: 0,
  startLift: 0,
  endLift: 0,
  thickness: 0.0065,
  mode: 'curve',
};

const STYLE_PROFILES: Record<string, BrowStyleProfile> = {
  natural_arch: { archMultiplier: 1.08, archOffset: 0, startLift: 0, endLift: 0.003, thickness: 0.0065, mode: 'curve' },
  straight: { archMultiplier: 0.22, archOffset: 0, startLift: 0.001, endLift: 0.001, thickness: 0.0058, mode: 'line' },
  soft_curve: { archMultiplier: 0.78, archOffset: 0, startLift: 0, endLift: 0, thickness: 0.0062, mode: 'curve' },
  soft_arch: { archMultiplier: 1.18, archOffset: -0.02, startLift: 0, endLift: 0.004, thickness: 0.0068, mode: 'curve' },
  curved: { archMultiplier: 1.03, archOffset: 0, startLift: -0.001, endLift: 0.001, thickness: 0.0064, mode: 'curve' },
  round: { archMultiplier: 0.92, archOffset: 0, startLift: -0.002, endLift: -0.002, thickness: 0.007, mode: 'round' },
  angular_arch: { archMultiplier: 1.34, archOffset: 0.03, startLift: -0.002, endLift: 0.005, thickness: 0.0062, mode: 'angular' },
  upward: { archMultiplier: 0.42, archOffset: 0.08, startLift: -0.004, endLift: 0.016, thickness: 0.0058, mode: 'line' },
  straight_angular: { archMultiplier: 0.72, archOffset: 0.05, startLift: -0.001, endLift: 0.006, thickness: 0.006, mode: 'angular' },
  straight_horizontal: { archMultiplier: 0.18, archOffset: 0, startLift: 0, endLift: 0, thickness: 0.0058, mode: 'line' },
  soft_straight: { archMultiplier: 0.35, archOffset: 0, startLift: 0, endLift: 0.002, thickness: 0.006, mode: 'curve' },
  low_arch: { archMultiplier: 0.58, archOffset: 0.01, startLift: 0, endLift: 0.002, thickness: 0.0062, mode: 'curve' },
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const point = (x: number, y: number): FacePoint => ({
  x: clamp(x, 0, 1),
  y: clamp(y, 0, 1),
});

const formatPoint = ({ x, y }: FacePoint) => `${(x * 100).toFixed(2)} ${(y * 100).toFixed(2)}`;

const interpolate = (start: FacePoint, end: FacePoint, t: number): FacePoint => ({
  x: start.x + ((end.x - start.x) * t),
  y: start.y + ((end.y - start.y) * t),
});

const distance = (a: FacePoint, b: FacePoint) => Math.hypot(a.x - b.x, a.y - b.y);

const projectRatio = (pointToProject: FacePoint, start: FacePoint, end: FacePoint) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = (dx * dx) + (dy * dy);
  if (lengthSquared <= 0) return 0.5;

  return (((pointToProject.x - start.x) * dx) + ((pointToProject.y - start.y) * dy)) / lengthSquared;
};

const buildControlPoints = (
  anchors: EyebrowOverlaySideAnchors,
  profile: BrowStyleProfile,
): BrowControlPoints => {
  const baselineRatio = clamp(projectRatio(anchors.hp, anchors.sp, anchors.ep) + profile.archOffset, 0.18, 0.82);
  const baselineHp = interpolate(anchors.sp, anchors.ep, baselineRatio);
  const baselineLength = distance(anchors.sp, anchors.ep);
  const naturalLift = Math.max(0.008, Math.abs(baselineHp.y - anchors.hp.y));
  const targetLift = Math.max(0.003, naturalLift * profile.archMultiplier);
  const sp = point(anchors.sp.x, anchors.sp.y - profile.startLift);
  const ep = point(anchors.ep.x, anchors.ep.y - profile.endLift);
  const hp = point(baselineHp.x, baselineHp.y - targetLift);
  const thickness = Math.max(0.0035, Math.min(0.014, profile.thickness + (baselineLength * 0.012)));

  return {
    sp,
    hp,
    ep,
    lowerSp: point(sp.x, sp.y + thickness),
    lowerHp: point(hp.x, hp.y + (thickness * 0.82)),
    lowerEp: point(ep.x, ep.y + (thickness * 0.75)),
  };
};

const buildCenterPath = (points: BrowControlPoints, profile: BrowStyleProfile) => {
  if (profile.mode === 'angular') {
    return `M ${formatPoint(points.sp)} L ${formatPoint(points.hp)} L ${formatPoint(points.ep)}`;
  }

  if (profile.mode === 'line') {
    return `M ${formatPoint(points.sp)} Q ${formatPoint(points.hp)} ${formatPoint(points.ep)}`;
  }

  if (profile.mode === 'round') {
    const firstControl = interpolate(points.sp, points.hp, 0.56);
    const secondControl = interpolate(points.ep, points.hp, 0.56);
    return `M ${formatPoint(points.sp)} C ${formatPoint(firstControl)} ${formatPoint(secondControl)} ${formatPoint(points.ep)}`;
  }

  return `M ${formatPoint(points.sp)} Q ${formatPoint(points.hp)} ${formatPoint(points.ep)}`;
};

const buildFillPath = (points: BrowControlPoints, profile: BrowStyleProfile) => {
  if (profile.mode === 'angular') {
    return [
      `M ${formatPoint(points.sp)}`,
      `L ${formatPoint(points.hp)}`,
      `L ${formatPoint(points.ep)}`,
      `L ${formatPoint(points.lowerEp)}`,
      `L ${formatPoint(points.lowerHp)}`,
      `L ${formatPoint(points.lowerSp)}`,
      'Z',
    ].join(' ');
  }

  return [
    `M ${formatPoint(points.sp)}`,
    `Q ${formatPoint(points.hp)} ${formatPoint(points.ep)}`,
    `L ${formatPoint(points.lowerEp)}`,
    `Q ${formatPoint(points.lowerHp)} ${formatPoint(points.lowerSp)}`,
    'Z',
  ].join(' ');
};

export const buildRecommendedEyebrowControlGeometry = (
  style: EyebrowStyle | null | undefined,
  anchors: EyebrowOverlayAnchors | null | undefined,
): RecommendedEyebrowControlGeometry | null => {
  if (!style || !anchors) return null;

  const profile = STYLE_PROFILES[style.id] ?? DEFAULT_PROFILE;

  return {
    left: buildControlPoints(anchors.left, profile),
    right: buildControlPoints(anchors.right, profile),
    mode: profile.mode,
    strokeWidth: profile.mode === 'line' ? 1.2 : 1.35,
    styleId: style.id,
  };
};

export const buildRecommendedEyebrowGeometry = (
  style: EyebrowStyle | null | undefined,
  anchors: EyebrowOverlayAnchors | null | undefined,
): ArEyebrowPath | null => {
  const controlGeometry = buildRecommendedEyebrowControlGeometry(style, anchors);
  if (!controlGeometry) return null;

  const profile = STYLE_PROFILES[controlGeometry.styleId] ?? DEFAULT_PROFILE;

  return {
    left: buildCenterPath(controlGeometry.left, profile),
    right: buildCenterPath(controlGeometry.right, profile),
    leftFill: buildFillPath(controlGeometry.left, profile),
    rightFill: buildFillPath(controlGeometry.right, profile),
    strokeWidth: controlGeometry.strokeWidth,
    styleId: controlGeometry.styleId,
    viewBox: '0 0 100 100',
  };
};
