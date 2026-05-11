# ClientLoop CRM

ClientLoop is a TypeScript modular-monolith CRM scaffold with shared domain contracts, a REST API, an outbox-ready async layer, PostgreSQL schema, and a Next.js web UI.

## What is implemented

- Shared `@clientloop/domain` package for CRM entities, permissions, custom fields, domain events, and business rules.
- Shared `@clientloop/contracts` package for Zod-validated REST payloads and an OpenAPI 3.1 object.
- Shared `@clientloop/ui-sdk` package for a typed browser/server API client.
- `@clientloop/api` Fastify service with CRM modules, auth context, object-level authorization checks, optimistic concurrency, idempotency handling, audit fields, and outbox event emission.
- Outbound webhook subscription APIs plus a worker that delivers signed outbox events with retry backoff.
- `@clientloop/web` Next.js app with a usable CRM cockpit: pipeline, accounts, contacts, tasks, activity timeline, search, and custom-field presentation.
- Prisma PostgreSQL schema covering tenants, users, roles, permissions, CRM records, custom fields, audit logs, outbox events, and webhook subscriptions.
- Markdown task tracking under `docs/tasks`.

## Run locally

```bash
npm install
npm run dev:api
npm run dev:web
npm run dev:worker -w @clientloop/api
```

The API runs on `http://localhost:4000` by default. The web app runs on `http://localhost:3000`.

The API uses Prisma when `DATABASE_URL` is set, and can still be forced to the in-memory repository with `CRM_REPOSITORY=memory` for fast isolated tests.

## Database

Start local PostgreSQL on this Mac and apply Prisma migrations:

```bash
cp .env.example .env
npm run db:setup
npm run prisma:migrate
npm run prisma:seed
```

The local database helper uses Homebrew PostgreSQL, creates the `clientloop` role and database, and reuses the same `DATABASE_URL` from `.env.example`.

The seed script loads the same canonical demo data used by the in-memory repository. The API uses Prisma when `DATABASE_URL` is set, and can be forced back to memory with `CRM_REPOSITORY=memory`.

## Webhooks

Create outbound webhook subscriptions as a manager or admin user:

```bash
curl -X POST http://localhost:4000/v1/webhooks/subscriptions \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000102' \
  -d '{"url":"https://example.com/clientloop","eventTypes":["opportunity.stage_changed"]}'
```

The create response includes `signingSecret` once. Worker deliveries sign the JSON payload with `X-ClientLoop-Signature` and include event metadata headers.

## Verify

```bash
npm run typecheck
npm test
npm run build
```

## CI

A GitHub Actions workflow template is stored at `docs/ci/github-actions-ci.yml`. Move it to `.github/workflows/ci.yml` after pushing with a GitHub token that includes the `workflow` scope.

## Architecture

The repo is organized as a modular monolith:

- `apps/api`: API, worker, scheduler, and webhook runtime entrypoints.
- `apps/web`: Next.js UI.
- `packages/domain`: canonical CRM types and business rules.
- `packages/contracts`: schema-validated API contracts.
- `packages/ui-sdk`: generated-style typed client boundary.
- `prisma`: PostgreSQL operational schema.
