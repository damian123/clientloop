# 0043 - Role-Aware Timeline Controls

## Goal

Apply session-derived permissions to record detail timeline actions so users do not see task, note, or activity controls that the API would reject.

## Completed

- [x] Extended the web permission helper with timeline create and object-scoped update affordances.
- [x] Added tests for own-scoped task, note, and activity update permission mapping.
- [x] Disabled record-detail task, note, and activity creation controls when create grants are absent.
- [x] Disabled per-item timeline correction buttons when update grants do not apply to that item.
- [x] Added handler-level guards for timeline create and correction submissions.

## Next

- Apply role-aware controls to the task queue edit and complete actions.
- Add an end-to-end permission scenario once the browser test harness exists.
