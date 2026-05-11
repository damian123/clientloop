# Task 0007: Frontend Session Wiring

## Goal

Move browser-side CRM actions onto the signed session and CSRF flow instead of sending development auth headers from the web UI.

## Checklist

- [x] Bootstrap a browser session from the Next.js CRM workspace.
- [x] Use session cookies and CSRF tokens for browser-side CRM mutations.
- [x] Keep local server-rendered dashboard data working with the existing seed fallback.
- [x] Show the active session user in the workspace chrome.
- [x] Add SDK coverage for credential and CSRF propagation.
- [x] Verify the UI still renders against the local API.

## Notes

- Local development logs in as the seed manager so export and import workflows remain available.
- Production sessions fall back to the existing authenticated cookie if local dev login is disabled.
