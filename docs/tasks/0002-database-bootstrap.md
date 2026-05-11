# Task 0002: Database Bootstrap

## Goal

Prepare the CRM for the Prisma-backed repository by making local macOS PostgreSQL startup and seed data repeatable.

## Status

Completed.

## Checklist

- [x] Add local Homebrew PostgreSQL setup script.
- [x] Add initial Prisma SQL migration.
- [x] Add Prisma seed script using the canonical domain seed data.
- [x] Add npm scripts for database startup, reset, generate, and seed.
- [x] Document the database workflow.
- [x] Run verification commands.

## Notes

- This task does not replace the API's in-memory repository yet.
- The next implementation task should add a Prisma-backed `CRMRepository` adapter behind the existing repository interface.
- The local database workflow uses Homebrew PostgreSQL instead of Docker.

## Verification

- `bash -n scripts/db-local.sh`
- `npm run db:setup`
- `DATABASE_URL='postgresql://clientloop:clientloop@localhost:5432/clientloop?schema=public' npx prisma migrate deploy`
- `DATABASE_URL='postgresql://clientloop:clientloop@localhost:5432/clientloop?schema=public' npx prisma db seed`
- Confirmed seeded counts: `accounts=3`, `opportunities=3`, `tasks=2`, `activities=2`
