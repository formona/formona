# Formona Verification Evidence

Date: 2026-05-11

## Scope

- Flattened the former `monabrow/` Next.js app into the repository root.
- Refactored source into clean architecture layers.
- Added deterministic unit and smoke coverage for domain, usecase,
  infrastructure, and React adapter flows.

## Architecture Evidence

- `src/domain` contains pure landmark, geometry, validation, and recommendation
  rules.
- `src/usecases` contains application orchestration and ports.
- `src/infrastructure` contains browser and MediaPipe adapters.
- `src/interface-adapters` contains React UI and hook adapters.
- Domain code does not import React, Next.js, MediaPipe, or browser APIs.

## Verification Commands

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test:unit`: 17 files, 120 tests passed.
- `npm run test:coverage`: passed with 97.63% lines/statements, 98.46%
  functions, and 84.68% global branches. Usecase, infrastructure, and
  recommendation boundaries have 95%+ branch gates.
- `npm run build`: passed and exported the static Next.js output to `dist/`.
