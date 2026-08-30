# ClientLoop CRM

ClientLoop is a TypeScript modular-monolith CRM scaffold with shared domain contracts, a REST API, an outbox-ready async layer, PostgreSQL schema, and a Next.js web UI.

> **Portfolio boundary:** This is a synthetic engineering scaffold for demonstrating CRM architecture and control design. The checked-in seed data is fictional. It is not a hosted service, a production-ready CRM, or a source of real prospect or customer data. Before production use, replace development authentication, complete a threat model and privacy review, configure managed secrets and durable infrastructure, and add operational monitoring, backup, recovery, and retention controls.

## What is implemented

- Shared `@clientloop/domain` package for CRM entities, permissions, custom fields, domain events, and business rules.
- Shared `@clientloop/contracts` package for Zod-validated REST payloads and an OpenAPI 3.1 object.
- Shared `@clientloop/ui-sdk` package for a typed browser/server API client.
- `@clientloop/api` Fastify service with CRM modules, auth context, object-level authorization checks, optimistic concurrency, idempotency handling, audit fields, and outbox event emission.
- BFF-style session cookies for the browser, local dev login, and CSRF checks on cookie-backed mutations.
- Account, contact, and opportunity creation plus lead creation and conversion workflows that create account, contact, optional opportunity, and lead conversion events in one command.
- Custom field definition creation APIs plus a web Data view for managing account, contact, lead, and opportunity field definitions.
- Custom field value editing for CRM records with validation and optimistic concurrency.
- Account, contact, lead, and opportunity detail panels for focused record context and custom field editing.
- URL-backed workspace state for shareable view and record detail links.
- Follow-up task creation, URL-backed task queue filters, copyable workspace links, dashboard refresh, and inline task corrections from record detail timelines and the main task queue.
- Plain-text note composition and inline note corrections from record detail timelines.
- Activity logging and correction for calls, emails, meetings, and events from record detail panels, including type-specific payload fields.
- Unified expandable record timeline in detail panels with filters for notes, tasks, and activities.
- Shared contextual create-form shell and actions across lead, account, contact, and opportunity forms.
- Tested create-form input builders for account, contact, lead, and opportunity validation.
- API regression coverage for direct account, contact, and opportunity create flows.
- Permission-negative API coverage for contextual create endpoints.
- Object-scope negative API coverage for opportunity and custom-field updates.
- Object-scope negative API coverage for task, note, and activity corrections.
- Permission-negative API coverage for bulk export and import preview endpoints.
- Playwright browser coverage for permission-aware custom field, toolbar create, timeline, task queue, pipeline, and Data view UI states plus opportunity stage movement, timeline create, correction, task completion, and CSV import/export workflows.
- Session-scoped permission metadata that drives role-aware bulk data controls in the web UI.
- Role-aware toolbar create controls for accounts, contacts, leads, and opportunities.
- Role-aware record detail controls for timeline creation and correction workflows.
- Role-aware task queue edit and complete controls.
- Role-aware custom field definition and record value controls.
- Outbound webhook subscription APIs plus a worker that delivers signed outbox events with retry backoff.
- CSV exports and import preview/commit workflows for accounts, contacts, and opportunities.
- `@clientloop/web` Next.js app with a usable session-backed CRM cockpit: pipeline, leads, accounts, contacts, tasks, activity timeline, search, and custom-field management.
- API-backed global search results in the workspace toolbar, alongside local active-view filtering.
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

## Authentication

For local development, the API keeps the existing `x-tenant-id` and `x-user-id` header fallback enabled. Browser sessions can also use:

```bash
curl -i -X POST http://localhost:4000/v1/session/dev-login \
  -H 'Content-Type: application/json' \
  -d '{}'
```

The response sets an HttpOnly `clientloop_session` cookie plus a readable CSRF cookie. Mutating requests authenticated by the session cookie must send the matching `X-CSRF-Token` header. In production, configure `SESSION_SIGNING_SECRET`, set `ALLOW_HEADER_AUTH=false`, and only enable `ALLOW_DEV_LOGIN` for trusted non-production environments.

## Database

Copy the example env file, start PostgreSQL, then apply Prisma migrations:

```bash
cp .env.example .env
```

Start PostgreSQL with Docker (any OS):

```bash
docker compose up -d
```

Or on macOS with Homebrew:

```bash
npm run db:setup
```

The Homebrew helper installs and starts PostgreSQL, creates the `clientloop` role and database, and matches `DATABASE_URL` in `.env.example`. Then:

```bash
npm run prisma:migrate
npm run prisma:seed
```

The seed script loads the same canonical demo data used by the in-memory repository. The API uses Prisma when `DATABASE_URL` is set, and can be forced back to memory with `CRM_REPOSITORY=memory`.

## Testing

Run the fast TypeScript test suite:

```bash
npm test
```

Run browser-level permission checks against local API and web servers:

```bash
npm exec playwright install chromium
npm run test:e2e
```

The Playwright harness starts isolated local servers on ports `4100` and `3100` with the in-memory repository.

## Webhooks

Create outbound webhook subscriptions as a manager or admin user:

```bash
curl -X POST http://localhost:4000/v1/webhooks/subscriptions \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: 00000000-0000-4000-8000-000000000102' \
  -d '{"url":"https://example.com/clientloop","eventTypes":["opportunity.stage_changed"]}'
```

The create response includes `signingSecret` once. Worker deliveries sign the JSON payload with `X-ClientLoop-Signature` and include event metadata headers.

## Import and export

The API exposes CSV workflows for core records:

```bash
curl -H 'x-user-id: 00000000-0000-4000-8000-000000000102' \
  http://localhost:4000/v1/exports/contacts

curl -X POST http://localhost:4000/v1/imports/contacts/preview \
  -H 'Content-Type: application/json' \
  -d '{"csv":"firstName,lastName,email\nTaylor,Nguyen,taylor@example.com"}'
```

The web app includes a `Data` view for CSV export plus account, contact, and opportunity import preview and commit.

### LinkedIn prospect live-signal handoffs

LinkedIn prospect imports use PostgreSQL as the source of truth and write generated handoff files under `outputs/linkedin-prospect-briefs`.

Import a researched CSV batch:

```bash
npm run crm:import-linkedin-prospects -- outputs/linkedin-prospect-imports/live-signals-2026-05-20.csv --batch live-signals-2026-05-20
```

Regenerate the standard account, lead, and follow-up Markdown briefs:

```bash
npm run crm:export-linkedin-briefs
```

Regenerate the live-signal operational handoff for a batch:

```bash
npm run crm:export-live-signal-handoff -- --batch live-signals-2026-05-20
```

The live-signal handoff command initializes missing review outcome fields, links batch-level tasks to the generated files, and writes the ranked queue, connection-note pack, outcome tracker, batch-task summary, and top-level handoff index. Start with `outputs/linkedin-prospect-briefs/<batch>-handoff.md`.

## Verify

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

## CI

`.github/workflows/ci.yml` audits production dependencies, then runs type checks, unit/API tests, Playwright end-to-end tests, and the production build on pull requests and pushes to `main`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

## Architecture

The repo is organized as a modular monolith:

- `apps/api`: API, worker, scheduler, and webhook runtime entrypoints.
- `apps/web`: Next.js UI.
- `packages/domain`: canonical CRM types and business rules.
- `packages/contracts`: schema-validated API contracts.
- `packages/ui-sdk`: generated-style typed client boundary.
- `prisma`: PostgreSQL operational schema.
