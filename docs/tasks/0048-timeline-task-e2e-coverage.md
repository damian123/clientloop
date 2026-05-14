# 0048 - Timeline And Task E2E Coverage

## Goal

Cover role-aware timeline and task queue controls in the browser test harness.

## Completed

- [x] Added a read-only session scenario where follow-up task, note, and activity submit buttons stay disabled even after draft input.
- [x] Added a read-only session scenario where timeline note correction stays disabled.
- [x] Added a positive Sales Rep task queue scenario where assigned task edit and complete actions are enabled.
- [x] Added a read-only session task queue scenario where assigned task edit and complete actions are disabled.

## Next

- Consider adding the e2e suite to CI after browser installation time is acceptable.
- Add browser coverage for successful create and correction submissions after mutation flows stabilize.
