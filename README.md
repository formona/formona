# Formona

Formona is a Next.js beauty device app MVP for real-time eyebrow analysis,
face-shape classification, personalized eyebrow recommendations, and AR eyebrow
overlay visualization.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key.
   For DB-backed admin measurements, also set `PRISMA_DATABASE_URL` or
   `POSTGRES_URL`. Set `FORMONA_ADMIN_PASSCODE` to override the demo admin
   passcode.
3. Run the app:
   `npm run dev`

The Next.js app is managed directly from the repository root. The previous
`monabrow/` subdirectory layout has been flattened, so package scripts,
configuration, source, and tests all live at the root.

## Architecture

Source follows a clean architecture split:

- `src/domain`: pure landmark, geometry, measurement, validation, and
  recommendation rules.
- `src/usecases`: application orchestration that composes domain rules through
  explicit ports.
- `src/interface-adapters`: React components, hooks, and UI helpers.
- `src/infrastructure`: browser and MediaPipe adapters.
- `src/app/api`: server API routes for measurement persistence and admin data
  access.

Dependency direction is inward: interface adapters and infrastructure call
usecases/domain, while domain code does not import React, Next.js, MediaPipe, or
browser APIs.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:coverage`
- `npm run test:e2e`

## Measurement Storage

Measurement results are stored in Prisma Postgres through:

- `POST /api/measurements`: saves the measurement payload generated after face
  analysis.
- `GET /api/admin/measurements`: returns saved records for the admin page when
  the `x-formona-admin-passcode` header matches `FORMONA_ADMIN_PASSCODE`.

Database setup uses Prisma migrations:

```sh
npm run db:generate
npm run db:migrate:deploy
```

The current schema stores searchable summary columns plus the full
`formona.measurement.v1` payload JSON for export and downstream mold-production
workflows.

Coverage is scoped to app source under `src/` and excludes tests, test setup,
type-only declarations, generated output, build output, e2e files, the Next.js
route shell, and the browser API tracking hook that is exercised through smoke
tests. The global gate requires at least 95% lines/statements/functions, with
95% branch gates on the usecase, infrastructure, and recommendation boundaries.

## MVP Flow

1. Splash screen
2. IPD input
3. Camera permission request
4. Live front-camera face alignment
5. Face-shape classification
6. Eyebrow style recommendation
7. AR eyebrow overlay with measurement output

## MVP Scope

- Front camera preview
- Face alignment guide overlay
- MediaPipe FaceMesh based landmark extraction
- Rule-based classification for oval, square, round, and heart face shapes
- Three eyebrow style recommendations per face shape
- IPD-based pixel-to-millimeter conversion
- Eyebrow measurement output
- Real-time eyebrow outline overlay

## Face-Scale Calibration

The MVP converts FaceMesh pixel distances to millimeters with user-entered IPD as
the single real-world reference:

```ts
pxToMmScale = referenceIpdMm / detectedPupilDistancePx
measurementMm = measurementPx * pxToMmScale
```

`referenceIpdMm` comes from the IPD step, using the saved/default value when the
input is invalid. `detectedPupilDistancePx` is measured in the live video frame
from MediaPipe FaceMesh landmarks. When iris landmarks are present, the app
averages each iris landmark cluster to estimate left/right pupil centers;
otherwise it falls back to eye-center landmarks with lower confidence. The scale
is only accepted after face alignment and IPD validation pass.

Assumptions for the demo:

- The user faces the camera directly and keeps the face inside the alignment
  guide.
- The entered IPD is the user's real binocular PD in millimeters; the default
  63mm is only a fallback.
- The front camera image is treated as a 2D pixel plane, so depth, lens
  distortion, and perspective effects are not separately modeled.
- All eyebrow metrics share the same IPD-derived scale for that analyzed frame.
- Measurement accuracy is MVP/demo level, targeting roughly +/-3-5mm when
  lighting, alignment, and IPD input are reasonable.

## Out of Scope for MVP

- Account, login, and history features
- Payment or commerce features
- Skin analysis
- Eyebrow color simulation
- Automatic stencil generation or production device integration
