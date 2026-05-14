# 0046 - Browser Permission Harness

## Goal

Add a repeatable browser-level test harness for permission-aware UI states.

## Completed

- [x] Added Playwright as an end-to-end test runner.
- [x] Added `npm run test:e2e` for browser checks.
- [x] Added a Playwright config that starts local API and web servers on isolated ports with the in-memory repository.
- [x] Added a development login user override so browser tests can exercise the Sales Rep session.
- [x] Covered custom-field editing controls for owned versus manager-owned account records.
- [x] Documented local browser test setup.

## Next

- Add browser coverage for role-aware toolbar create controls.
- Add browser coverage for timeline and task queue controls.
- Consider adding the e2e suite to CI after browser installation time is acceptable.
