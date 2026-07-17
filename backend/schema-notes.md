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

## 2026-07-16 - students + artwork_photos (migration_id 23)

- New `students` table: parent-owned child profiles (`user_id`, `name`, `age`,
  `dob`, `notes`). RLS user-isolation on `user_id` with auto-populate trigger.
- New `artwork_photos` table: photo metadata (`student_id` -> students CASCADE,
  `storage_object_id` durable Butterbase Storage objectId, `caption`,
  `uploaded_by`). RLS enabled with a SELECT policy that lets a parent read
  rows whose student they own (`EXISTS students.user_id = current_user_id()`).
  Writes go through the `manage-artwork` function (service role) so the parent
  never needs direct INSERT/DELETE on this table.
- New functions: `manage-account`, `manage-students`, `manage-artwork`
  (all `auth: required`, `allow_service_key_impersonation: false`).

## 2026-07-16 - enrollment student association (migration_id 28)

- Added nullable `enrollments.student_id` foreign key to `students.id` with
  `ON DELETE SET NULL`, plus `idx_enrollments_student` for student enrollment
  lookups. Existing enrollments remain intact until their parent associates
  them from the account page.
