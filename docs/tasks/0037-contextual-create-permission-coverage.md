# 0037 - Contextual Create Permission Coverage

## Goal

Verify contextual create endpoints fail closed when a principal lacks create permissions.

## Completed

- [x] Added a custom API test seed where the Sales Rep role has create grants removed.
- [x] Verified account creation returns 403 without account create permission.
- [x] Verified contact creation returns 403 without contact create permission.
- [x] Verified opportunity creation returns 403 without opportunity create permission.

## Next

- Add object-scope negative tests for update and custom-field edits.
- Add frontend affordance checks once permission-aware UI states are introduced.
