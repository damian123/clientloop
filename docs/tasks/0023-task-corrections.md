# 0023 - Task Corrections

## Goal

Allow users to correct task titles, descriptions, due dates, and priorities from the record timeline while preserving server-side version checks.

## Completed

- [x] Added `PATCH /v1/tasks/:id` with optimistic concurrency.
- [x] Added repository support for updating task details without completing the task.
- [x] Added typed SDK support for task updates.
- [x] Added inline task correction controls in record timelines.
- [x] Emitted `task.updated` domain events for corrected task records.

## Next

- Add a dedicated full-history drawer with pagination once timelines need server-backed history loading.
- Add task editing from the main task queue.
