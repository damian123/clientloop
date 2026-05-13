# 0038 - Object Scope Update Coverage

## Goal

Verify users cannot update records outside their object-level authorization scope.

## Completed

- [x] Added an API test for a rep updating a manager-owned opportunity.
- [x] Added an API test for a rep updating custom fields on a manager-owned account.
- [x] Verified both endpoints return 403 before version or validation effects are applied.

## Next

- Add object-scope negative tests for task, note, and activity corrections.
- Add permission-aware UI affordances once role-aware frontend state is introduced.
