# Contributing

This repository is a synthetic CRM scaffold. Keep that boundary: no real prospect, customer, or employer data.

## Development

```bash
npm ci
npm run typecheck
npm test
```

Browser checks:

```bash
npm exec playwright install chromium
npm run test:e2e
```

PostgreSQL is optional for the unit/API suite (`CRM_REPOSITORY=memory`). For Prisma-backed runs, start Postgres with `docker compose up -d` or `npm run db:setup`, then `npm run prisma:migrate`.

## Pull requests

`main` is protected. Open a short-lived branch, keep the change focused, and include tests when behavior changes.

- [ ] Typecheck and unit/API tests pass
- [ ] Playwright coverage updated when UI or permission behavior changes
- [ ] README or task notes updated when a workflow is added or removed
- [ ] No secrets, real prospect data, or personal data
