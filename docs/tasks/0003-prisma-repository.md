# Task 0003: Prisma Repository

## Goal

Switch the API from the in-memory repository to a PostgreSQL-backed Prisma repository while keeping the existing repository interface and memory adapter available for tests and local fallback.

## Status

Completed.

## Checklist

- [x] Add `PrismaCRMRepository` adapter.
- [x] Add repository driver selection from environment.
- [x] Default to Prisma when `DATABASE_URL` exists.
- [x] Keep explicit memory repository injection for unit tests.
- [x] Add persistence integration test that writes through one repository instance and reads through another.
- [x] Verify API and frontend against the Prisma-backed backend.
- [x] Push commit.

## Verification

- `npm run typecheck`
- `npm test`
- API smoke: `POST /v1/accounts` returned `201` and the account was found in PostgreSQL.
- API health: `GET /health` returned `status: ok`.
- Dashboard API: `3` accounts, `3` opportunities, `2` tasks, `2` activities.
- Frontend: `GET /` returned `200` and rendered `ClientLoop`, `Pipeline`, `Accounts`, and `Contacts`.
