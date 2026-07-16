# Schema migration notes

Applied via `POST /v1/app_48ul5eszfv7v/schema/apply` (full-schema declarative
payload; the endpoint treats omitted tables as drops and refuses them without
`_drop`, so always send the complete schema from `GET /schema`).

## 2026-07-15 - guest checkout (migration_id 21)

- `enrollments.user_id` made nullable (guest enrollments are unclaimed until
  the buyer verifies their email).
- `idx_enrollments_order`: unique index on `enrollments.stripe_order_id`
  (duplicate-webhook safety; Postgres unique indexes permit multiple NULLs).
- `idx_enrollments_email`: index on `enrollments.student_email` (claim query).

## 2026-07-16 - schedule session type

- Added nullable `class_schedules.session_type` (`text`). New schedules store
  `standard`, `extended`, or `full`; existing schedules continue to infer the
  session type from their start and end times.
