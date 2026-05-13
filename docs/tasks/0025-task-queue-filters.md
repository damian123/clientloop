# 0025 - Task Queue Filters

## Goal

Keep the main task queue usable as task volume grows by letting users narrow tasks by status, owner, and due date.

## Completed

- [x] Added task queue filters for status, owner scope, and due date.
- [x] Scoped the owner filter to the current signed-in user.
- [x] Added a filtered count summary and an empty state.
- [x] Kept the filters client-side so they work with the existing dashboard payload.

## Next

- Add saved queue views once user preferences are persisted.
- Move filters to the API once task volume requires server-side pagination.
