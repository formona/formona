import {
  FaceShape,
  type CameraPermissionState,
  type FaceShapeResultCopy,
} from './domain/types';

export enum Page {
  SPLASH = 0,
  INTRO = 1,
  IPD_INPUT = 2,
  CAPTURE = 3,
  RECOMMENDATIONS = 4,
  RESULT = 5,
}

export const BRAND_COLORS = {
  brown: '#4F2C1D',
  gray: '#727171',
  faceGuideDetected: '#4ADE80',
  faceGuideIdle: 'rgba(255,255,255,0.4)',
} as const;

export const IPD_CONFIG = {
  storageKey: 'monabrow_ipd',
  // Used as the documented assumed real-world IPD when the user has not entered a valid value.
  defaultMm: 63,
  minMm: 45,
  maxMm: 80,
  inputStep: 0.1,
} as const;

export const APP_TIMING_MS = {
  splash: 1500,
} as const;

export const FRONT_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'user' },
    width: { ideal: 1080 },
    height: { ideal: 1920 },
    aspectRatio: { ideal: 0.5625 },
  },
};

export const FRONT_CAMERA_FALLBACK_CONSTRAINTS: MediaStreamConstraints[] = [
  FRONT_CAMERA_CONSTRAINTS,
  {
    audio: false,
    video: {
      facingMode: { exact: 'user' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  },
  {
    audio: false,
    video: {
      facingMode: 'user',
    },
  },
];

export const MEDIAPIPE_VISION_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
export const MEDIAPIPE_FACE_LANDMARKER_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
export const MEDIAPIPE_FACE_MESH_LANDMARK_COUNT = 468;

export const CAMERA_PERMISSION_COPY: Record<Exclude<CameraPermissionState, 'granted'>, {
  title: string;
  description: string;
  actionLabel: string;
  guidance?: Array<{
    title: string;
    steps: string[];
  }>;
}> = {
  idle: {
    title: '전면 카메라 권한이 필요합니다',
    description: '얼굴 정렬과 눈썹 AR 미리보기를 위해 모바일 브라우저 카메라를 실행합니다.',
    actionLabel: '카메라 허용',
  },
  pending: {
    title: '카메라 권한을 확인하고 있습니다',
    description: '브라우저 권한 팝업에서 카메라 접근을 허용해주세요.',
    actionLabel: '카메라 요청 중',
  },
  denied: {
    title: '카메라 권한이 차단되었습니다',
    description: '브라우저 또는 휴대폰 설정에서 MONABROW 사이트의 카메라 접근을 허용한 뒤 다시 시도해주세요.',
    actionLabel: '권한 다시 요청',
    guidance: [
      {
        title: 'iPhone Safari',
        steps: [
          '주소창의 가가/퍼즐 메뉴 또는 Safari 설정에서 이 사이트의 카메라를 허용',
          '설정 > Safari > 카메라가 거부로 되어 있다면 허용으로 변경',
          '앱으로 돌아와 권한 다시 요청 탭',
        ],
      },
      {
        title: 'Android Chrome',
        steps: [
          '주소창의 자물쇠 아이콘 > 권한 > 카메라를 허용',
          'Chrome 설정 > 사이트 설정 > 카메라에서 차단 목록을 확인',
          '페이지를 새로고침한 뒤 권한 다시 요청 탭',
        ],
      },
    ],
  },
  unavailable: {
    title: '카메라를 사용할 수 없습니다',
    description: 'HTTPS 또는 모바일 Safari/Chrome에서 접속했는지 확인해주세요. 현재 환경에서는 이미지 업로드로만 진행할 수 있습니다.',
    actionLabel: '다시 확인',
  },
};

export const FACE_SHAPE_RESULT_COPY: Record<FaceShape, FaceShapeResultCopy> = {
  [FaceShape.OVAL]: {
    title: '전체적으로 균형 잡힌 계란형 얼굴이에요',
    description: '어떤 스타일도 잘 어울리는 가장 이상적인 페이스 라인을 가지셨네요.',
    insight: '부드러운 곡선을 더하면 자연스러운 매력이 극대화됩니다.',
  },
  [FaceShape.SQUARE]: {
    title: '세련되고 각진 얼굴형에 가까워요',
    description: '매력적이고 뚜렷한 골격 구조가 강조되는 고급스러운 인상입니다.',
    insight: '아치형 디자인으로 각진 부분을 감싸면 더욱 부드러운 이미지가 완성됩니다.',
  },
  [FaceShape.ROUND]: {
    title: '부드럽고 친숙한 둥근 얼굴형을 가지셨네요',
    description: '어려 보이는 동안 외모와 상냥한 분위기가 돋보이는 형태입니다.',
    insight: '각진 아치 스타일로 얼굴에 입체감을 더하면 더욱 또렷하고 성숙한 분위기를 연출할 수 있습니다.',
  },
  [FaceShape.HEART]: {
    title: '브이라인이 돋보이는 하트형 얼굴이에요',
    description: '이마가 넓고 턱선이 갸름하여 세련되고 도회적인 이미지가 강합니다.',
    insight: '평행한 직선 스타일로 상하 균형을 맞춰주면 차분한 인상을 줄 수 있습니다.',
  },
};
