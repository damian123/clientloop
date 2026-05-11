# Task 0005: CSV Import and Export

## Goal

Implement a practical first import/export workflow for CRM data: CSV exports for core records, contact CSV import preview, contact import commit, SDK support, and a usable UI surface.

## Status

Completed.

## Checklist

- [x] Add task tracking entry.
- [x] Add CSV import/export contracts.
- [x] Add API routes and services.
- [x] Add typed SDK methods.
- [x] Add Data view in the CRM UI.
- [x] Add tests.
- [x] Run verification commands.
- [x] Push commit.

## Notes

- Keep the first import scope to contacts so validation and error reporting are strong.
- Support fixed headers and aliases before adding saved mapping templates.
- Exports should cover accounts, contacts, and opportunities.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run build`
- API smoke: `GET /v1/exports/contacts`
- API smoke: `POST /v1/imports/contacts/preview`
- Browser smoke: Data view renders and contact import preview returns `1` valid row with no client errors.
