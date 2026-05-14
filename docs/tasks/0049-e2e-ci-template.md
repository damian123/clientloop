# 0049 - E2E CI Template

## Goal

Add the Playwright e2e suite to the documented GitHub Actions CI workflow template.

## Completed

- [x] Updated `docs/ci/github-actions-ci.yml` to install Chromium for Playwright.
- [x] Added `npm run test:e2e` to the documented CI verification sequence.
- [x] Updated README verification and CI notes to include browser e2e coverage.
- [x] Kept the workflow under `docs/ci` because the repo has not yet moved workflows without a GitHub token that includes `workflow` scope.

## Next

- Move `docs/ci/github-actions-ci.yml` to `.github/workflows/ci.yml` once GitHub credentials can push workflow files.
- Reassess CI runtime after the e2e suite grows beyond permission-state coverage.
