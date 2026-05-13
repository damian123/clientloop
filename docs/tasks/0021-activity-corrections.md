# 0021 - Activity Corrections

## Goal

Allow users to correct logged activity details without losing the original timeline context.

## Completed

- [x] Added `PATCH /v1/activities/:id` with optimistic concurrency.
- [x] Added repository support for updating activity subjects and structured payloads.
- [x] Added typed SDK support for activity updates.
- [x] Added inline activity correction controls in record timelines.
- [x] Emitted `activity.updated` domain events for corrected activity records.

## Next

- Add note editing or append-only correction notes.
- Add a dedicated full-history drawer with pagination once timelines need server-backed history loading.
