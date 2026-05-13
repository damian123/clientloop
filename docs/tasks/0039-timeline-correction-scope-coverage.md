# 0039 - Timeline Correction Scope Coverage

## Goal

Verify timeline correction endpoints respect object-level authorization scope.

## Completed

- [x] Added an API test for a rep updating a manager-assigned task.
- [x] Added an API test for a rep updating a manager-created note.
- [x] Added an API test for a rep updating a manager-created activity.
- [x] Verified all three correction endpoints return 403 outside the principal scope.

## Next

- Add frontend permission-aware disabled states when role-aware UI state is introduced.
- Add audit log assertions once immutable audit events are exposed through tests.
