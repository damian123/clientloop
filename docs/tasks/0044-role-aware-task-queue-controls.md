# 0044 - Role-Aware Task Queue Controls

## Goal

Apply session-derived task update permissions to the task queue edit and complete controls.

## Completed

- [x] Passed timeline task update permissions into the task queue.
- [x] Disabled queue edit and complete buttons when the active session cannot update the task.
- [x] Guarded queue task edit submission with the same object-scoped permission check.
- [x] Guarded task completion before optimistic local state updates.

## Next

- Add end-to-end permission scenarios once the browser test harness exists.
