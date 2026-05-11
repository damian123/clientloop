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

- The first implementation uses an in-memory repository for immediate local execution.
- PostgreSQL durability is represented by the Prisma schema and can be wired behind the repository interface next.
- Future work should add real OAuth/OIDC BFF session handling, database-backed outbox delivery, GraphQL read layer, and import/export jobs.
- The CI workflow is stored as `docs/ci/github-actions-ci.yml` until GitHub push credentials include the `workflow` scope.

## Verification

- `npm run typecheck`
- `npm test`
- `DATABASE_URL='postgresql://clientloop:clientloop@localhost:5432/clientloop?schema=public' npx prisma validate --schema prisma/schema.prisma`
- `npm run build`
- `npm audit --omit=dev`

## Follow-up Tasks

- [ ] Replace the in-memory repository with a Prisma-backed repository using expand-and-contract migration discipline.
- [ ] Add OAuth/OIDC BFF session handling with secure cookies and CSRF protection.
- [ ] Persist outbox events and implement webhook delivery retries with signed payloads.
- [ ] Add import/export jobs and CSV field mapping.
- [ ] Add Playwright end-to-end coverage for opportunity stage movement and task completion.
- [ ] Add optional GraphQL read layer for dense record detail screens.
