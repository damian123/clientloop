# ClientLoop

TypeScript CRM modular monolith with Fastify, Next.js, Prisma, permissions, outbox delivery, and Playwright.

Portfolio project using fictional data. It is not connected to an employer, client, or production system.

[![CI](https://github.com/damian123/clientloop/actions/workflows/ci.yml/badge.svg)](https://github.com/damian123/clientloop/actions/workflows/ci.yml)

![ClientLoop workspace](docs/crm-workspace.svg)

![Architecture](docs/architecture.svg)

## Capabilities

- Shared domain, Zod contracts, and OpenAPI for accounts, contacts, leads, opportunities, and conference workflows
- Fastify API with object-level permissions, optimistic concurrency, idempotency, audit fields, and a signed webhook outbox
- Next.js workspace with pipeline, records, tasks, timeline, search, CSV import/export, and role-aware controls
- Prisma/PostgreSQL schema for tenants, users, CRM records, custom fields, audit logs, and outbox events
- Conference prospecting with scoring, lawful-basis checks, opt-out enforcement, and CSV templates
- Playwright coverage for permissions, timeline, pipeline, and import workflows

## Run in two minutes

```bash
npm ci
CRM_REPOSITORY=memory npm run dev:api
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000). Local browser sessions use:

```bash
curl -i -X POST http://localhost:4000/v1/session/dev-login \
  -H 'Content-Type: application/json' \
  -d '{}'
```

The API defaults to port 4000 and the web app to port 3000. Mutating cookie-backed requests must send the matching `X-CSRF-Token` header.

### PostgreSQL path

```bash
cp .env.example .env
docker compose up -d
npm run prisma:migrate
npm run prisma:seed
```

`DATABASE_URL` selects Prisma. `CRM_REPOSITORY=memory` keeps tests and demos off the database.

## Verification and CI

```bash
npm run typecheck
npm test
npm exec playwright install chromium
npm run test:e2e
npm run build
```

`.github/workflows/ci.yml` runs the production dependency audit, typecheck, unit/API tests, Playwright, and production build on `main` and pull requests.

## Design decisions

- Permissions are object-scoped and enforced in the API, then reflected in the UI from session metadata.
- Record updates use optimistic concurrency (`expectedVersion`) rather than last-write-wins.
- Domain events are written to an outbox in the same unit of work; a worker delivers signed webhooks with retry.
- Conference scoring is a pure domain function with explicit bands; opted-out people cannot enter outreach states.
- Custom fields, CSV import preview, and Playwright permission cases are first-class rather than afterthoughts.

See [LIMITATIONS.md](LIMITATIONS.md) and [SECURITY.md](SECURITY.md).
