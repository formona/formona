# Formona Next.js/Vercel 프로토타입 개발 플랜

작성일: 2026-05-05

## 1. 목표

Formona 프로토타입은 Next.js와 Vercel로 구현하는 모바일 웹 MVP이다. 사용자는 iOS/Android 브라우저에서 전면 카메라 권한을 허용하고, 얼굴 landmark 기반 얼굴형 분류, 눈썹 스타일 추천, AR 눈썹 윤곽선, IPD 기반 mm 수치를 한 흐름에서 확인한다.

원본 `formona_plan.md`는 크로스플랫폼 앱을 희망하지만, 이번 단계의 실행 방향은 사용자가 명시한 대로 `Next.js + Vercel` 프로토타입이다. 따라서 "앱" 요구사항은 설치형 네이티브 앱이 아니라 Vercel HTTPS 환경에서 실행되는 모바일 웹/PWA 후보로 해석한다.

## 2. 원본 기획 분석 요약

| 원본 요구 | 근거 | 프로토타입 반영 |
| --- | --- | --- |
| iOS/Android 크로스플랫폼 희망 | `formona_plan.md:8` | iOS Safari 16.4+, Android Chrome 최신 버전을 1차 지원 브라우저로 둔다. |
| STEP 1~7 원본 화면 | `formona_plan.md:12`, `formona_plan.md:69`, `formona_plan.md:125` | 사용자 최신 요구에 따라 스플래시 뒤 서비스 소개 메인 페이지를 추가해 8단계 state machine으로 구현한다. |
| 서비스 소개 메인 페이지 | 사용자 추가 요구 | 스플래시 이후 IPD 입력 전에 서비스 가치, 진행 흐름, 개인정보/온디바이스 처리 안내, 시작 CTA를 보여준다. |
| 전면 카메라 | `formona_plan.md:106`, `formona_plan.md:204` | browser `getUserMedia({ video: { facingMode: "user" } })`로 구현한다. |
| MediaPipe FaceMesh 468포인트 | `formona_plan.md:108` | Web용 MediaPipe Face Landmarker는 iris 포함 478 landmark 결과를 사용한다. |
| 얼굴형 4종 룰베이스 | `formona_plan.md:224` | landmark feature와 threshold v0/v1로 계란형/각형/둥근형/하트형을 분류한다. |
| 얼굴형별 추천 3종 | `formona_plan.md:242` | 코드 상수 테이블로 추천 카드 3개를 표시한다. |
| SP/HP/EP 기준 AR | `formona_plan.md:264` | iris center, 콧볼, 눈꼬리, 인중 후보 landmark로 Canvas overlay path를 만든다. |
| 7개 수치 mm 출력 | `formona_plan.md:292` | IPD 입력값과 양쪽 iris center px 거리로 `mmPerPx`를 계산한다. |
| 24fps, 100ms, 10초 플로우 | `formona_plan.md:308`, `formona_plan.md:330` | 브라우저 debug HUD와 Playwright/device QA에서 측정한다. |
| MVP 제외 기능 | `formona_plan.md:115` | 로그인, 히스토리, 서버 저장, 결제, 커머스, 피부 분석, 색상 시뮬레이션 제외. |

## 3. 공식 문서 기반 기술 기준

| 영역 | 기준 |
| --- | --- |
| Next.js | 공식 설치 문서 기준 Node.js 20.9 이상, App Router, TypeScript 프로젝트로 시작한다. |
| Client Components | 카메라, Canvas, MediaPipe 실행 컴포넌트는 브라우저 API가 필요하므로 `'use client'` 경계 안에 둔다. |
| Vercel | Git 연동 배포를 기본으로 하며, PR마다 Preview Deployment URL을 생성한다. |
| Camera | `getUserMedia`는 HTTPS 또는 localhost 같은 secure context가 필요하므로 Vercel 배포 환경이 적합하다. |
| Front camera | 모바일 웹에서는 `facingMode: "user"`를 요청한다. 브라우저/권한 선택에 따라 다른 카메라가 잡힐 수 있어 fallback UI를 둔다. |
| MediaPipe Web | `@mediapipe/tasks-vision` 패키지와 `face_landmarker.task` 모델 asset을 사용한다. |
| MediaPipe inference | Web Face Landmarker는 `IMAGE`/`VIDEO` running mode를 제공한다. 카메라 stream은 `VIDEO` + `detectForVideo()`를 사용한다. |
| Threading | Web `detectForVideo()`는 동기 실행으로 UI thread를 block할 수 있으므로 M1에서 main-thread와 Web Worker/OffscreenCanvas 옵션을 비교한다. |

참고 문서:

- MediaPipe Face Landmarker Web: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
- Next.js installation: https://nextjs.org/docs/app/getting-started/installation
- Next.js `use client`: https://nextjs.org/docs/app/api-reference/directives/use-client
- Vercel Git deployments: https://vercel.com/docs/git
- MDN `getUserMedia`: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

## 4. 권장 프로토타입 아키텍처

### 4.1 기술 스택

| 항목 | 선택 |
| --- | --- |
| Framework | Next.js App Router |
| Language | TypeScript |
| Styling | Tailwind CSS 또는 CSS Modules. 프로토타입 속도는 Tailwind 우선 |
| Runtime | Browser client-side inference 중심 |
| Deployment | Vercel Git Integration |
| Landmark | `@mediapipe/tasks-vision` Face Landmarker Web |
| Camera | `navigator.mediaDevices.getUserMedia` |
| Overlay | `<canvas>` 2D rendering. 병목 시 OffscreenCanvas 검토 |
| Storage | `localStorage`로 IPD만 저장 |
| Test | Vitest(unit), Playwright(e2e/visual/camera mock), 수동 실기기 QA |

### 4.2 디렉터리 구조

```txt
formona-web/
  app/
    layout.tsx
    page.tsx
    globals.css
  components/
    flow/
      FormonaFlow.tsx
      SplashStep.tsx
      MainIntroStep.tsx
      IpdStep.tsx
      PermissionStep.tsx
      CameraStep.tsx
      FaceShapeStep.tsx
      RecommendationStep.tsx
      ResultStep.tsx
    camera/
      CameraPreview.tsx
      FaceGuideOverlay.tsx
      BrowCanvasOverlay.tsx
      DebugHud.tsx
    ui/
      Button.tsx
      Modal.tsx
      MetricPanel.tsx
  lib/
    mediapipe/
      createFaceLandmarker.ts
      landmarkIndexes.ts
      resultMapper.ts
    analysis/
      coordinateMapper.ts
      qualityGate.ts
      ipdCalibration.ts
      faceShapeClassifier.ts
      recommendations.ts
      browGeometry.ts
      measurements.ts
    state/
      flowState.ts
      storage.ts
  public/
    models/
      face_landmarker.task
  tests/
    analysis/
    e2e/
```

루트에 기존 `formona_plan.md`와 `plan.md`가 있으므로 실제 Next.js 앱은 `formona-web/` 하위에 생성하는 것을 권장한다. 단일 repo 루트 앱으로 갈 경우 README의 `spec.md` 참조 불일치부터 정리한다.

## 5. 핵심 데이터 파이프라인

```txt
Vercel HTTPS page load
  -> STEP 1 splash
  -> STEP 2 service intro/main page
  -> STEP 3 IPD input/localStorage
  -> STEP 4 getUserMedia permission
  -> <video playsInline muted>
  -> requestAnimationFrame loop
  -> FaceLandmarker.detectForVideo(video, timestamp)
  -> 478 normalized landmarks
  -> video pixel/canvas coordinate mapping
  -> face quality gate
  -> iris center + mmPerPx
  -> face shape features + classifier
  -> recommendation cards
  -> selected brow style
  -> SP/HP/EP + Bezier path
  -> canvas AR overlay + 7 metrics panel
```

## 6. MVP STEP별 개발 요구사항

### STEP 1. 스플래시

원본 근거: `formona_plan.md:155`

기능:

- 첫 진입 시 Formona 로고 또는 텍스트 로고를 표시한다.
- 1.5초 후 서비스 소개 메인 페이지로 자동 이동한다.
- URL route 이동 없이 client state로 전환해 카메라 권한 요청이 먼저 뜨지 않게 한다.

완료 기준:

- Vercel Preview URL에서 cold load 후 1.5초 안팎에 STEP 2 서비스 소개로 이동한다.
- 스플래시 단계에서 카메라 권한 prompt가 발생하지 않는다.

### STEP 2. 서비스 소개 메인 페이지

사용자 추가 요구: 스플래시 이후 서비스 소개/메인 페이지를 먼저 보여주고, 그 다음 IPD 입력으로 이동한다.

기능:

- Formona 서비스의 핵심 목적을 한 화면에서 설명한다: 얼굴형 분석, 눈썹 추천, AR 미리보기, mm 수치 확인.
- 사용자가 앞으로 진행할 흐름을 짧게 보여준다: `IPD 입력 -> 카메라 촬영 -> 얼굴형 분석 -> 눈썹 추천 -> AR 확인`.
- 카메라/얼굴 데이터는 브라우저 내에서 처리하고 원본 영상은 서버로 전송하지 않는다는 개인정보 안내를 표시한다.
- `시작하기` CTA를 누르면 STEP 3 IPD 입력으로 이동한다.
- `자세히 보기` 또는 접이식 영역으로 측정 기준/IPD 안내를 보여줄 수 있지만, 카메라 권한 요청은 이 단계에서 발생하지 않는다.

완료 기준:

- 스플래시 이후 메인 페이지가 먼저 표시된다.
- `시작하기`를 누르기 전에는 IPD 입력 화면으로 이동하지 않는다.
- 메인 페이지에서는 카메라 권한 prompt가 발생하지 않는다.
- `시작하기` 클릭 시 STEP 3으로 이동한다.

### STEP 3. IPD 입력

원본 근거: `formona_plan.md:162`, `formona_plan.md:193`

기능:

- 기본값은 `63mm`이다.
- 입력 범위는 `45~80mm`로 제한한다.
- 값은 `localStorage`에 저장하고 재방문 시 복원한다.
- `모르시나요?` 버튼은 원본 안내 문구 기반의 modal을 표시한다.
- `다음` 버튼은 유효한 숫자일 때만 활성화한다.

계산:

```ts
irisDistancePx = distance(leftIrisCenterPx, rightIrisCenterPx)
mmPerPx = userIpdMm / irisDistancePx
pxToMm(distancePx) = distancePx * mmPerPx
```

품질 기준:

- 양쪽 iris center가 모두 감지된 frame에서만 `mmPerPx`를 갱신한다.
- `irisDistancePx`가 최근 안정값 대비 15% 이상 급변하면 해당 frame은 버린다.
- IPD를 모르는 사용자는 기본값으로 진행하되 내부 상태에 `ipdSource: "default"`를 남긴다.

테스트:

- `localStorage` 저장/복원 unit test.
- 45 미만/80 초과 입력 validation test.
- mock iris distance 300px, IPD 63mm일 때 `mmPerPx = 0.21`.

### STEP 4. 카메라 권한

원본 근거: `formona_plan.md:197`

기능:

- `navigator.mediaDevices?.getUserMedia` 지원 여부를 먼저 확인한다.
- HTTPS/localhost가 아니어서 API가 없으면 "보안 연결에서만 카메라를 사용할 수 있습니다"를 표시한다.
- 권한 요청 constraints:

```ts
{
  audio: false,
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 }
  }
}
```

- `NotAllowedError`는 권한 거부 안내로 처리한다.
- `NotFoundError`는 카메라 없음 안내로 처리한다.
- 권한 거부 시 브라우저 주소창/설정에서 권한을 변경하라는 안내를 제공한다. 네이티브 "설정 앱 이동" 버튼은 웹에서 직접 보장할 수 없으므로 브라우저 설정 안내로 대체한다.

완료 기준:

- iOS Safari와 Android Chrome에서 권한 허용 시 `<video>` preview가 표시된다.
- 권한 거부/카메라 없음/비보안 origin 예외 문구가 구분된다.
- stream 종료 시 `MediaStreamTrack.stop()`을 호출한다.

### STEP 5. 실시간 카메라와 얼굴 정렬

원본 근거: `formona_plan.md:204`

기능:

- 전면 카메라 preview를 full-screen 또는 fixed camera stage로 표시한다.
- `<video>` 위에 `canvas` 또는 CSS overlay로 타원형 얼굴 guide를 그린다.
- 얼굴 미감지 상태는 흰색 점선 guide와 `정면을 바라봐 주세요` 문구를 표시한다.
- 얼굴 감지/품질 통과 상태는 초록색 실선 guide로 전환한다.
- 조명 부족 상태는 `밝은 곳에서 촬영해 주세요`를 표시한다.

MediaPipe 설정:

```ts
FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "/models/face_landmarker.task",
  },
  runningMode: "VIDEO",
  numFaces: 1,
  minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  outputFaceBlendshapes: false,
  outputFacialTransformationMatrixes: true,
})
```

M1 spike에서 transformation matrix 비용이 크면 `outputFacialTransformationMatrixes`는 false로 내리고 yaw/roll은 landmark geometry로 추정한다.

Quality gate v0:

| 항목 | 기준 |
| --- | --- |
| 얼굴 수 | 정확히 1명 |
| landmark 수 | iris 포함 478개 |
| 얼굴 위치 | 얼굴 bbox 중심이 guide 중심에서 화면 폭/높이의 12% 이내 |
| 얼굴 크기 | 얼굴 높이가 화면 높이의 45~75% |
| yaw | 절대값 20도 이하 |
| roll | 절대값 12도 이하 |
| tracking | 최근 5 frame 중 4 frame 이상 성공 |
| 조명 | video frame luminance 평균이 threshold 이상 |

완료 기준:

- 얼굴 없음/복수 얼굴/회전 과다/조명 부족을 분석 시작 전에 막는다.
- 품질 통과가 500ms 이상 유지되면 STEP 6으로 이동한다.
- debug HUD에 FPS, inference ms, landmark count, quality status를 표시할 수 있다.

### STEP 6. 얼굴형 분류 결과

원본 근거: `formona_plan.md:220`, `formona_plan.md:224`

분류 대상:

- 계란형
- 각형
- 둥근형
- 하트형

Feature v0:

| Feature | 계산 | 후보 landmark |
| --- | --- | --- |
| `faceHeight` | 얼굴 상단 proxy부터 턱까지 거리 | 10, 152 |
| `cheekWidth` | 좌우 광대 폭 | 234, 454 |
| `jawWidth` | 좌우 턱선 폭 | 172, 397 후보 |
| `foreheadWidth` | 상안면 proxy 폭 | 103, 332 후보 |
| `widthHeightRatio` | `cheekWidth / faceHeight` | 둥근형/계란형 |
| `jawCheekRatio` | `jawWidth / cheekWidth` | 각형/하트형 |
| `foreheadCheekRatio` | `foreheadWidth / cheekWidth` | 하트형 보조 |
| `jawAngleScore` | 턱선 좌우 angle 평균 | 각형/둥근형 보조 |

초기 threshold v0:

| 얼굴형 | 기준 |
| --- | --- |
| 계란형 | `0.62 <= widthHeightRatio <= 0.74`, `0.72 <= jawCheekRatio <= 0.90` |
| 둥근형 | `widthHeightRatio >= 0.80`, 턱선 angle 낮음 |
| 각형 | `jawCheekRatio >= 0.88`, `abs(foreheadCheekRatio - 1.0) <= 0.12` |
| 하트형 | `foreheadCheekRatio >= 0.96`, `jawCheekRatio <= 0.82` |

주의:

- MediaPipe에는 실제 헤어라인 landmark가 없으므로 `foreheadWidth`는 이마 proxy이다.
- 하트형은 앞머리/헤어라인 영향이 크므로 confidence가 낮으면 `재촬영`을 허용한다.
- 데모 모드에서는 원본 DoD를 맞추기 위해 최고 score 얼굴형을 표시하되 `lowConfidence` flag를 남긴다.

샘플 튜닝:

- 프로토타입 내부에 `feature sample export` 버튼을 dev-only로 둔다.
- 원본 얼굴 이미지는 저장하지 않고 landmark-derived feature JSON만 다운로드한다.
- 얼굴형별 20개 이상, 총 80개 이상 유효 sample로 threshold v1을 조정한다.

완료 기준:

- quality 통과 후 4종 중 1종 또는 승인된 `재촬영` 상태가 표시된다.
- 결과 카드에는 얼굴형명, confidence, 간단한 설명을 표시한다.
- 같은 사용자/같은 조명에서 결과가 frame마다 흔들리지 않는다.

### STEP 7. 눈썹 스타일 추천

원본 근거: `formona_plan.md:237`, `formona_plan.md:242`

추천 매핑:

| 얼굴형 | 추천 1 | 추천 2 | 추천 3 |
| --- | --- | --- | --- |
| 계란형 | 자연 아치형 | 직선형 | 부드러운 곡선형 |
| 각형 | 부드러운 아치형 | 곡선형 | 라운드형 |
| 둥근형 | 각진 아치형 | 상승형 | 직선 각형 |
| 하트형 | 직선 수평형 | 부드러운 직선형 | 낮은 아치형 |

Style parameter v0:

| 스타일 | `archLift` | `tailLift` | `thicknessMm` | `curveTension` |
| --- | ---: | ---: | ---: | ---: |
| 자연 아치형 | 0.12 | -0.02 | 6.0 | 0.45 |
| 직선형 | 0.03 | 0.00 | 5.5 | 0.20 |
| 부드러운 곡선형 | 0.08 | -0.01 | 5.8 | 0.35 |
| 부드러운 아치형 | 0.10 | -0.03 | 6.0 | 0.40 |
| 곡선형 | 0.09 | -0.02 | 5.8 | 0.42 |
| 라운드형 | 0.07 | -0.04 | 6.2 | 0.50 |
| 각진 아치형 | 0.16 | 0.02 | 5.8 | 0.30 |
| 상승형 | 0.10 | 0.06 | 5.5 | 0.25 |
| 직선 각형 | 0.05 | 0.04 | 5.6 | 0.18 |
| 직선 수평형 | 0.02 | 0.00 | 5.4 | 0.18 |
| 부드러운 직선형 | 0.04 | -0.01 | 5.5 | 0.24 |
| 낮은 아치형 | 0.06 | -0.02 | 5.6 | 0.32 |

기능:

- 카드 3개를 수평 스크롤 또는 segmented card list로 표시한다.
- 카드에는 스타일명, 간단 설명, CSS/SVG 기반 눈썹 preview를 표시한다.
- 선택 시 STEP 8로 이동한다.

완료 기준:

- 얼굴형별 추천이 원본 매핑과 일치한다.
- 선택된 style parameter가 AR geometry에 전달된다.

### STEP 8. AR 오버레이 + 수치 출력

원본 근거: `formona_plan.md:255`, `formona_plan.md:264`, `formona_plan.md:292`

Landmark index 후보:

| 용도 | 후보 | 확정 방식 |
| --- | --- | --- |
| iris center | 468~477 | 좌/우 iris contour 평균, debug overlay로 좌우 확정 |
| 눈꼬리 | 33, 263 | mirror 보정 테스트 |
| 콧볼 | 98, 327 후보 | SP 수직선 기준 |
| 인중/상순 중앙 | 0, 13, 164 후보 | EP 대각선 기준 |
| 턱 | 152 | 얼굴 세로 |
| 얼굴 상단 proxy | 10 | 얼굴 세로 |
| 광대 | 234, 454 | 얼굴 폭 |

SP/HP/EP:

| 기준점 | 계산 |
| --- | --- |
| SP | 콧볼 x좌표를 눈썹 기준 y영역으로 수직 투영 |
| HP | 같은 side iris center x좌표를 기본 anchor로 사용 |
| EP | 인중 중심에서 눈꼬리 방향 선을 연장해 눈썹 기준 y영역과 만나는 점 |

황금비 보정:

```ts
targetHpRatio = 1.618 / (1 + 1.618) // 0.618
actualHpRatio = distance(SP, project(HP, line(SP, EP))) / distance(SP, EP)
```

- `actualHpRatio`가 `0.58~0.66`이면 iris 기준 HP를 그대로 사용한다.
- 범위를 벗어나면 iris anchor와 황금비 target을 70:30으로 보간한다.

Canvas rendering:

- `<video>`와 같은 위치/크기의 `<canvas>`를 absolute overlay로 둔다.
- devicePixelRatio를 반영해 canvas backing store를 키운다.
- 매 frame마다 이전 overlay를 clear하고 좌우 eyebrow Bezier path를 그린다.
- 기본 선 색상은 `#C9A96E`, opacity `0.65`.
- yaw 20도 초과, iris 미감지, 얼굴 미감지 300ms 이상이면 path를 숨긴다.
- 눈 깜빡임으로 iris가 흔들릴 때 최근 안정값을 최대 250ms 유지한다.

7개 수치:

| 항목 | 계산 |
| --- | --- |
| 눈썹 시작점 SP | 얼굴 중심 또는 좌우 기준선 대비 SP 좌표를 mm로 표시 |
| 눈썹 최고점 HP | SP-EP 기준선 대비 HP 위치/높이 |
| 눈썹 끝점 EP | SP 대비 EP 위치 |
| 눈썹 전체 길이 | `distance(SP, EP) * mmPerPx` |
| 눈썹 두께 | MVP는 style parameter의 `thicknessMm` |
| 아치 높이 | `perpendicularDistance(HP, line(SP, EP)) * mmPerPx` |
| 눈썹 간격 | `distance(leftSP, rightSP) * mmPerPx` |

완료 기준:

- 카메라 preview 위에 추천 눈썹 윤곽선이 실시간으로 표시된다.
- 하단 패널에 7개 수치가 `mm` 단위로 표시된다.
- `다시 찍기`는 STEP 5로 돌아간다.
- `저장하기`는 MVP에서 제거하거나 disabled + v2 예정으로 처리한다.

## 7. 웹 프로토타입 제약과 대응

| 제약 | 영향 | 대응 |
| --- | --- | --- |
| iOS Safari의 카메라/Canvas/WASM 성능 편차 | 24fps 미달 가능 | resolution throttle, inference frame skip, Worker 검토 |
| `getUserMedia`는 secure context 필요 | HTTP 배포에서 카메라 불가 | Vercel HTTPS와 localhost 개발만 지원 |
| `detectForVideo()` 동기 실행 | UI thread jank 가능 | M1에서 Worker 가능성 검증, 최소 15fps fallback 정의 |
| 브라우저 설정으로 권한 이동 불가 | 네이티브 UX와 차이 | 권한 재설정 안내 modal 제공 |
| 원본 DoD의 "실기기 앱 실행" | 설치형 앱과 다름 | iPhone/Android 실기기 브라우저에서 Vercel URL 실행으로 검증 |
| Face Landmarker 모델 크기 | 초기 로드 지연 | model preload/loading UI, Vercel static asset cache |
| 얼굴 데이터 개인정보 | 신뢰/법무 리스크 | on-device inference, 원본 이미지/영상 서버 전송 금지 |

## 8. 구현 마일스톤

### M0. Scope Lock

작업:

- Next.js/Vercel 프로토타입을 공식 1차 범위로 확정한다.
- 원본 "설정 앱 이동"은 브라우저 권한 안내로 대체한다고 명시한다.
- `저장하기` 버튼은 제거 또는 disabled로 결정한다.
- README의 `spec.md` 참조를 `formona_plan.md`로 정정할지 결정한다.

통과 기준:

- MVP 제외 기능이 plan과 backlog에서 분리된다.
- "설치형 앱"이 아니라 "Vercel 모바일 웹 프로토타입"임이 이해관계자에게 공유된다.

### M1. Next.js + MediaPipe Web Spike

작업:

- `formona-web` Next.js TypeScript app을 생성한다.
- `@mediapipe/tasks-vision`을 설치한다.
- `public/models/face_landmarker.task`를 배치한다.
- 카메라 preview와 Face Landmarker `VIDEO` inference loop를 구현한다.
- iOS Safari/Android Chrome에서 478 landmark 수신 여부를 확인한다.
- main thread 기준 FPS/inference ms를 측정한다.
- 필요 시 Worker/OffscreenCanvas spike를 분리한다.

통과 기준:

- Vercel Preview URL에서 카메라 권한 허용 후 preview가 나온다.
- 최소 Android Chrome 1대, iOS Safari 1대에서 landmark count가 478로 기록된다.
- 평균 24fps 목표 달성 여부와 병목이 기록된다.

### M2. Analysis Domain

작업:

- `CoordinateMapper`, `IpdCalibration`, `QualityGate`, `FaceShapeClassifier`, `BrowGeometry`, `Measurements`를 순수 TypeScript로 구현한다.
- mock landmark fixtures를 만든다.
- 얼굴형 threshold v0와 추천 테이블을 코드화한다.
- dev-only feature JSON export를 만든다.

테스트:

- IPD/mm 환산 unit test.
- landmark 부족/iris 미감지 reject test.
- 얼굴형 4종 archetype fixture test.
- SP/HP/EP와 7개 수치 계산 test.

통과 기준:

- 카메라 없이 `npm test`에서 analysis domain이 검증된다.
- threshold와 index map이 코드/문서에 함께 남는다.

### M3. STEP 1~8 UI Flow

작업:

- Splash, MainIntro, IPD, Permission, Camera, FaceShape, Recommendation, Result step을 구현한다.
- client state machine으로 화면 전환을 제어한다.
- 예외 상태 modal/toast를 구현한다.
- 모바일 viewport 기준 레이아웃을 우선한다.

통과 기준:

- STEP 1~8이 최신 화면 흐름과 일치한다.
- 스플래시 이후 서비스 소개 메인 페이지가 먼저 나오고, 사용자가 `시작하기`를 누른 뒤 IPD 입력으로 이동한다.
- 사용자가 메인 페이지에서 머무르는 시간은 성능 측정에서 제외하고, `시작하기` 탭부터 AR overlay까지 10초 이내 happy path를 목표로 한다.
- 권한 거부, 얼굴 미감지, 조명 부족, 재촬영이 동작한다.

### M4. AR Geometry & Visual QA

작업:

- landmark debug overlay를 만든다.
- iris, 콧볼, 눈꼬리, 인중 후보 index를 실기기에서 확인한다.
- Canvas eyebrow path를 스타일별로 조정한다.
- mirror/orientation 테스트를 수행한다.
- 4개 얼굴형 x 3개 스타일 screenshot을 남긴다.

통과 기준:

- 좌우 눈썹이 뒤집히지 않는다.
- SP/HP/EP 위치가 미용적으로 납득 가능하다.
- yaw ±20도 안에서는 overlay가 유지되고, 초과 시 숨김 처리된다.

### M5. Face Shape Threshold 튜닝

작업:

- 얼굴형별 20개 이상, 총 80개 이상 feature sample을 수집한다.
- 원본 이미지/영상은 저장하지 않는다.
- 라벨러가 계란형/각형/둥근형/하트형/불확실을 검수한다.
- threshold v1과 confidence rule을 확정한다.

통과 기준:

- 각 얼굴형별 통과율과 불확실 비율이 기록된다.
- 데모 대상자에서 3회 연속 같은 결과 또는 허용 가능한 결과가 나온다.

### M6. Vercel Demo Readiness

작업:

- GitHub repository를 Vercel project로 연결한다.
- PR/branch마다 Preview Deployment URL을 생성한다.
- `npm run build`, unit test, Playwright smoke test를 CI/PR gate로 둔다.
- Vercel Web Analytics 또는 custom debug log로 Web Vitals/FPS를 확인한다.
- 데모 시나리오와 fallback 화면을 준비한다.

통과 기준:

- production deployment URL이 있다.
- iPhone 12 이상, Galaxy S21 이상급 실기기 브라우저에서 접속 가능하다.
- AR 화면 평균 24fps 이상 또는 명시적 fallback 기준이 문서화되어 있다.
- 서비스 소개에서 `시작하기`를 탭한 뒤 AR overlay까지 10초 이내 happy path가 3회 연속 성공한다.

## 9. Acceptance Criteria

### 기능

- [ ] Next.js/Vercel 프로토타입 범위가 `plan.md`에 명시되어 있다.
- [ ] STEP 1~8 화면/상태가 모두 존재한다.
- [ ] 스플래시 이후 서비스 소개 메인 페이지가 표시되고, `시작하기` 후 IPD 입력으로 이동한다.
- [ ] IPD 기본값 63mm와 `localStorage` 복원이 동작한다.
- [ ] HTTPS/localhost에서 카메라 권한 요청이 동작한다.
- [ ] `facingMode: "user"` 전면 카메라 preview가 표시된다.
- [ ] MediaPipe Face Landmarker Web에서 478 landmarks를 수신한다.
- [ ] quality gate 실패 시 분석/overlay를 멈추고 안내를 표시한다.
- [ ] 얼굴형 4종 classifier와 confidence/재촬영 처리가 동작한다.
- [ ] 얼굴형별 추천 카드 3종이 원본 매핑대로 표시된다.
- [ ] 선택한 스타일로 Canvas AR eyebrow path가 표시된다.
- [ ] 7개 수치가 mm 단위로 표시된다.
- [ ] 다시 찍기 버튼이 카메라 단계로 돌아간다.

### 성능

- [ ] initial model load 상태가 사용자에게 표시된다.
- [ ] AR 결과 화면 평균 FPS가 24 이상이다.
- [ ] inference-to-overlay latency p95가 100ms 이내이거나, fallback/최적화 계획이 있다.
- [ ] 서비스 소개에서 `시작하기`를 탭한 뒤 AR overlay까지 10초 이내다.
- [ ] UI thread jank가 심하면 Worker/프레임 스킵 fallback이 적용된다.

### 배포

- [ ] Vercel Preview Deployment URL이 PR마다 생성된다.
- [ ] Production Deployment URL이 데모에 사용 가능하다.
- [ ] `face_landmarker.task` 모델 asset이 Vercel에서 정상 로드된다.
- [ ] HTTPS 환경에서만 카메라 기능을 활성화한다.

### 품질/개인정보

- [ ] iOS Safari와 Android Chrome에서 카메라/landmark/mirror가 검증된다.
- [ ] 원본 얼굴 이미지/영상은 서버로 전송하지 않는다.
- [ ] feature sample export는 dev-only이며 개인정보 고지를 포함한다.
- [ ] 권한 거부, 얼굴 미감지, 조명 부족, 복수 얼굴, 회전 과다, iris 미감지 예외가 처리된다.

## 10. Definition of Done

| 원본 완료 기준 | 웹 프로토타입 검증 방식 | 통과 조건 |
| --- | --- | --- |
| 실기기 실행 | iPhone 12+/Galaxy S21+급 기기 브라우저에서 Vercel URL 접속 | 두 플랫폼에서 페이지와 카메라 preview 실행 |
| 카메라~AR 전체 플로우 | 수동 QA + Playwright smoke | STEP 4부터 STEP 8까지 중단 없음 |
| 얼굴형 4종 중 1종 출력 | fixture + 실기기 샘플 | 4종 중 1종 또는 승인된 재촬영 상태 |
| 눈썹 수치 7개 표시 | unit test + 결과 화면 확인 | SP, HP, EP, 길이, 두께, 아치 높이, 간격 표시 |
| 24fps 이상 | debug HUD/Performance API | AR 화면 평균 24fps 이상 또는 fallback 승인 |
| 전체 플로우 10초 이내 | timestamp log | 서비스 소개에서 `시작하기`를 누른 뒤 AR overlay까지 10초 이내. 사용자 체류 시간은 제외 |

## 11. 즉시 다음 작업

1. `formona-web` Next.js TypeScript 프로젝트를 생성한다.
2. `@mediapipe/tasks-vision`과 `face_landmarker.task` asset 로딩 spike를 만든다.
3. Vercel Preview URL에서 `getUserMedia` 권한/전면 카메라 동작을 검증한다.
4. 478 landmark 수신과 iris index 좌우 mapping을 debug overlay로 확정한다.
5. IPD/mm 환산, quality gate, 얼굴형 classifier, 7개 수치 계산을 unit test로 먼저 구현한다.
6. STEP 1~8 UI flow를 client state machine으로 연결한다.
7. iOS Safari/Android Chrome 실기기에서 24fps/100ms/10초 기준을 측정한다.

## 12. 남은 협의 항목

- `저장하기` 버튼을 완전 제거할지, disabled + v2 예정으로 둘지.
- `재촬영/불확실` 상태를 원본 DoD의 "4종 중 1종"보다 우선할지.
- feature sample export를 누가 검수하고, 총 80개 sample 수집 일정을 어떻게 잡을지.
- Vercel production domain을 임시 `vercel.app`으로 둘지, 브랜드 도메인을 연결할지.
- 웹 프로토타입 이후 네이티브 앱/PWA 전환 계획을 언제 다시 판단할지.
