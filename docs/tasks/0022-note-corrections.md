# 0022 - Note Corrections

## Goal

Allow users to correct note text from the record timeline while preserving server-side version checks.

## Completed

- [x] Added `PATCH /v1/notes/:id` with optimistic concurrency.
- [x] Added repository support for updating note bodies and formats.
- [x] Added typed SDK support for note updates.
- [x] Added inline note correction controls in record timelines.
- [x] Emitted `note.updated` domain events for corrected note records.

## Next

- Add a dedicated full-history drawer with pagination once timelines need server-backed history loading.
- Add task editing for due dates, titles, and priorities.
