# 0046 - Browser Permission Harness

## Goal

Add a repeatable browser-level test harness for permission-aware UI states.

## Completed

- [x] Added Playwright as an end-to-end test runner.
- [x] Added `npm run test:e2e` for browser checks.
- [x] Added a Playwright config that starts local API and web servers on isolated ports with the in-memory repository.
- [x] Added a development login user override so browser tests can exercise the Sales Rep session.
- [x] Covered custom-field editing controls for owned versus manager-owned account records.
- [x] Covered role-aware toolbar New controls for create-capable views, Data view, and no-create sessions.
- [x] Covered timeline create and correction controls for sessions without timeline permissions.
- [x] Covered task queue edit and complete controls for allowed and denied task update permissions.
- [x] Documented local browser test setup.

## Next

- Move the CI workflow template into `.github/workflows/ci.yml` once the GitHub token has `workflow` scope.
