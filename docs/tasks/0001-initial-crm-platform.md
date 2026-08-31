# Task 0001: Initial CRM Platform

## Goal

Implement the TypeScript CRM baseline described in the high-level design: modular monolith, PostgreSQL-ready schema, shared contracts, REST API, async outbox foundation, and production-oriented React/Next.js UI.

## Status

Completed for initial scaffold.

## Checklist

- [x] Create npm workspace and TypeScript project structure.
- [x] Add task tracking docs.
- [x] Implement canonical domain models and business rules.
- [x] Implement API contracts and typed SDK.
- [x] Implement REST API with auth context, tenancy, optimistic concurrency, and outbox events.
- [x] Add Prisma schema for PostgreSQL primary store.
- [x] Implement Next.js CRM UI.
- [x] Add tests and CI workflow.
- [x] Run verification commands.

## Notes

- The implementation keeps the in-memory repository available for tests and fallback.
- PostgreSQL durability is now wired through the Prisma repository when `DATABASE_URL` is set.
- OAuth/OIDC BFF login, the bounded GraphQL detail read layer, and import/export jobs are implemented in focused follow-up work.
- The CI workflow is stored as `docs/ci/github-actions-ci.yml` until GitHub push credentials include the `workflow` scope.

## Verification

- `npm run typecheck`
- `npm test`
- `DATABASE_URL='postgresql://clientloop:clientloop@localhost:5432/clientloop?schema=public' npx prisma validate --schema prisma/schema.prisma`
- `npm run build`
- `npm audit --omit=dev`

## Follow-up Tasks

- [x] Replace the in-memory repository with a Prisma-backed repository using expand-and-contract migration discipline.
- [x] Add OAuth/OIDC BFF session handling with secure cookies and CSRF protection.
- [x] Persist outbox events and implement webhook delivery retries with signed payloads.
- [x] Add import/export jobs and CSV field mapping.
- [x] Add Playwright end-to-end coverage for opportunity stage movement and task completion.
- [x] Add optional GraphQL read layer for dense record detail screens.
