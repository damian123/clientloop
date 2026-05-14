# 0048 - Timeline And Task E2E Coverage

## Goal

Cover role-aware timeline and task queue controls in the browser test harness.

## Completed

- [x] Added a read-only session scenario where follow-up task, note, and activity submit buttons stay disabled even after draft input.
- [x] Added a read-only session scenario where timeline note correction stays disabled.
- [x] Added a positive Sales Rep task queue scenario where assigned task edit and complete actions are enabled.
- [x] Added a read-only session task queue scenario where assigned task edit and complete actions are disabled.
- [x] Added a positive browser workflow for creating timeline task, note, and activity entries.

## Next

- Move the CI workflow template into `.github/workflows/ci.yml` once the GitHub token has `workflow` scope.
- Add browser coverage for successful correction submissions after mutation flows stabilize.
