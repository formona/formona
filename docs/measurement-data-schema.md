# Formona Measurement Data Schema

## Purpose

This schema turns the current MONABROW measurement result into a business-owned
data contract for Formona. The app may show measurements to the user, but the
primary record is the measurement data used for custom stencil/form work.

The first collection version is document-first:

- Client payload: `formona.measurement.v1`
- Validation contract: `schemas/formona.measurement.v1.schema.json`
- Initial API body: the current `MeasurementDataPayload`
- Server-generated fields: submission id, received timestamp, audit metadata

The default contract intentionally excludes raw camera images, raw FaceMesh
landmarks, account identity, payment data, and skin-analysis data.

## API Contract

`POST /api/measurement-submissions`

Request body is the `formona.measurement.v1` JSON payload produced by
`buildMeasurementDataPayload`.

Response:

```json
{
  "submissionId": "uuid",
  "schemaVersion": "formona.measurement.v1",
  "receivedAtIso": "2026-05-21T00:00:00.000Z",
  "reportable": true
}
```

Recommended server behavior:

- Validate the request body against `schemas/formona.measurement.v1.schema.json`.
- Generate `submissionId` server-side.
- Store the full validated payload as JSON for traceability.
- Store the key measurements in typed columns for dashboard/search/export.
- Reject payloads with unknown schema versions.
- Accept `quality.reportable = false`, but keep those records out of production
  stencil queues until reviewed.

## Top-Level Payload

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schemaVersion` | string | yes | Must be `formona.measurement.v1`. |
| `measuredAtIso` | ISO datetime | yes | Client-side measurement creation time. |
| `faceShape` | enum | yes | `계란형`, `각형`, `둥근형`, `하트형`. |
| `selectedStyle` | object or null | yes | Selected recommendation id/name. |
| `ipdMm` | number | yes | User-entered or fallback IPD in mm. |
| `pxToMmScale` | number | yes | Pixel-to-mm conversion factor for the analyzed frame. |
| `pupilIpd` | object | yes | Calibration source and detected IPD confidence. |
| `metrics` | array | yes | Exactly seven eyebrow metrics. |
| `goldenRatioGuides` | object | yes | SP/HP/EP guide lines and golden-ratio distances. |
| `overlayAnchors` | object | yes | Normalized SP/HP/EP anchors for both sides. |
| `quality` | object | yes | Reportability and estimated measurement quality. |

## Required Metrics

The `metrics` array must contain exactly one item for each key:

| Key | Label | Meaning |
| --- | --- | --- |
| `sp` | 눈썹 시작점 (SP) | Nostril vertical guide line length. |
| `hp` | 눈썹 최고점 (HP) | Iris-center vertical guide line length. |
| `ep` | 눈썹 끝점 (EP) | Philtrum-to-eye-corner diagonal guide line length. |
| `totalLength` | 눈썹 전체 길이 | SP to EP distance. |
| `thickness` | 눈썹 두께 | Recommended brow thickness estimate. |
| `archHeight` | 아치 높이 | Perpendicular distance from baseline to HP. |
| `gap` | 눈썹 간격 | Distance between left/right SP anchors. |

Each metric stores:

- `valueMm`: numeric value used by Formona.
- `displayValue`: UI-friendly formatted value.
- `reportable`: whether the metric meets collection quality thresholds.
- `confidence`: normalized confidence, when available.
- `estimatedErrorMm`: estimated error in mm, when available.

## Golden-Ratio Guides

`goldenRatioGuides.left` and `goldenRatioGuides.right` contain:

- `anchors.sp`: eyebrow start point.
- `anchors.hp`: eyebrow high point. `source` should be `iris` when MediaPipe
  iris landmarks are available, otherwise `eye-center`.
- `anchors.ep`: eyebrow end point.
- `anchors.goldenRatioTarget`: computed SP-to-EP golden-ratio target.
- `lines.sp`: nostril-to-SP guide line.
- `lines.hp`: iris-center-to-HP guide line.
- `lines.ep`: philtrum-to-EP diagonal guide line.
- `distancesMm`: SP-to-HP, HP-to-EP, SP-to-EP, and HP height.
- `hpPositionRatio`: HP projection along SP-to-EP.
- `actualGoldenRatio`: observed `SP->HP / HP->EP` ratio.

`goldenRatioGuides.average` stores the averaged left/right values used for
summary display and downstream stencil decisions.

## Database Shape

Use PostgreSQL with a JSONB source-of-truth plus typed columns for core queries.

```sql
create table measurement_submissions (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null check (schema_version = 'formona.measurement.v1'),
  measured_at timestamptz not null,
  received_at timestamptz not null default now(),

  face_shape text not null check (face_shape in ('계란형', '각형', '둥근형', '하트형')),
  selected_style_id text,
  selected_style_name text,

  ipd_mm numeric(5,1) not null check (ipd_mm >= 45 and ipd_mm <= 80),
  px_to_mm_scale numeric(12,8) not null check (px_to_mm_scale > 0),
  pupil_source text not null check (pupil_source in ('iris', 'eye-center')),
  pupil_ipd_px numeric(10,4),
  pupil_normalized_ipd numeric(8,6) not null check (pupil_normalized_ipd > 0),
  pupil_confidence numeric(4,3) not null check (pupil_confidence >= 0 and pupil_confidence <= 1),

  metric_sp_mm numeric(6,2) not null,
  metric_hp_mm numeric(6,2) not null,
  metric_ep_mm numeric(6,2) not null,
  metric_total_length_mm numeric(6,2) not null,
  metric_thickness_mm numeric(6,2) not null,
  metric_arch_height_mm numeric(6,2) not null,
  metric_gap_mm numeric(6,2) not null,

  golden_sp_line_mm numeric(6,2) not null,
  golden_hp_line_mm numeric(6,2) not null,
  golden_ep_line_mm numeric(6,2) not null,
  golden_sp_to_hp_mm numeric(6,2) not null,
  golden_hp_to_ep_mm numeric(6,2) not null,
  golden_sp_to_ep_mm numeric(6,2) not null,
  golden_hp_height_mm numeric(6,2) not null,
  golden_hp_position_ratio numeric(7,5) not null,
  golden_actual_ratio numeric(7,5) not null,

  quality_overall_confidence numeric(4,3),
  quality_max_estimated_error_mm numeric(5,2),
  quality_reportable boolean not null,
  quality_alignment_ready boolean not null,

  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index measurement_submissions_received_at_idx
  on measurement_submissions (received_at desc);

create index measurement_submissions_quality_idx
  on measurement_submissions (quality_reportable, quality_alignment_ready);

create index measurement_submissions_face_shape_idx
  on measurement_submissions (face_shape);
```

Optional normalized metric table for analytics:

```sql
create table measurement_submission_metrics (
  submission_id uuid not null references measurement_submissions(id) on delete cascade,
  metric_key text not null,
  label text not null,
  description text not null,
  value_mm numeric(6,2) not null,
  reportable boolean not null,
  confidence numeric(4,3),
  estimated_error_mm numeric(5,2),
  primary key (submission_id, metric_key),
  check (metric_key in ('sp', 'hp', 'ep', 'totalLength', 'thickness', 'archHeight', 'gap'))
);
```

## Mapping From Current Client Payload

| Database column | Payload path |
| --- | --- |
| `schema_version` | `schemaVersion` |
| `measured_at` | `measuredAtIso` |
| `face_shape` | `faceShape` |
| `selected_style_id` | `selectedStyle.id` |
| `selected_style_name` | `selectedStyle.name` |
| `ipd_mm` | `ipdMm` |
| `px_to_mm_scale` | `pxToMmScale` |
| `pupil_source` | `pupilIpd.source` |
| `pupil_ipd_px` | `pupilIpd.ipdPx` |
| `metric_sp_mm` | `metrics[key=sp].valueMm` |
| `metric_hp_mm` | `metrics[key=hp].valueMm` |
| `metric_ep_mm` | `metrics[key=ep].valueMm` |
| `golden_actual_ratio` | `goldenRatioGuides.average.actualGoldenRatio` |
| `quality_reportable` | `quality.reportable` |
| `payload` | full request body |

## Versioning Rules

- Keep `formona.measurement.v1` backward compatible.
- Add optional fields only when possible.
- Bump to `formona.measurement.v2` for renamed fields, removed fields, changed
  units, or changed metric semantics.
- Never reinterpret an existing numeric field without a schema version bump.

## Next Implementation Step

The next code step should add a collection boundary:

1. `POST /api/measurement-submissions` route or equivalent backend endpoint.
2. JSON Schema validation against `schemas/formona.measurement.v1.schema.json`.
3. Submission adapter that sends `buildMeasurementDataPayload(...)`.
4. Retry/error UI that does not block the existing JSON download fallback.
