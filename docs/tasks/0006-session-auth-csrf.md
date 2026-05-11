# Task 0006: Session Auth and CSRF Foundation

## Goal

Add a browser-safe authentication baseline before expanding CRM workflows: signed session cookies, CSRF protection for cookie-authenticated mutations, and typed SDK support.

## Checklist

- [x] Add shared session request and response contracts.
- [x] Add local development login and logout API routes.
- [x] Prefer signed session cookies in API auth while preserving local header auth.
- [x] Enforce CSRF tokens for unsafe methods when a session cookie is present.
- [x] Add UI SDK session, dev login, logout, credential, and CSRF helpers.
- [x] Document local auth environment variables and usage.
- [x] Cover session auth and CSRF behavior with API tests.

## Notes

- Header auth remains enabled by default outside production so local automation and existing dev scripts keep working.
- Production should set `SESSION_SIGNING_SECRET`, `ALLOW_HEADER_AUTH=false`, and leave `ALLOW_DEV_LOGIN` disabled.
