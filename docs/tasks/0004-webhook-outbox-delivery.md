# Task 0004: Webhook Outbox Delivery

## Goal

Turn the existing outbox table into an operational outbound webhook path: tenant admins can register webhook subscriptions, workers can deliver signed events, and failed events are retried with backoff.

## Status

Completed.

## Checklist

- [x] Add webhook subscription API contracts and SDK methods.
- [x] Add subscription repository methods for memory and Prisma adapters.
- [x] Add signing secret storage support to the Prisma schema.
- [x] Implement signed webhook delivery from pending outbox rows.
- [x] Retry failed deliveries using `attempts` and `nextAttemptAt`.
- [x] Add route and delivery tests.
- [x] Run verification commands.
- [x] Push commit.

## Notes

- `POST /v1/webhooks/subscriptions` returns the signing secret only on creation.
- Outbound deliveries use `X-ClientLoop-Signature`, `X-ClientLoop-Event-Id`, and `X-ClientLoop-Event-Type` headers.
- Subscription secrets are stored in a dedicated column for local development. Production hardening should replace this with KMS-backed encryption.

## Verification

- `npm run prisma:generate`
- `npx prisma migrate deploy`
- `npm run prisma:seed`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npx tsx apps/api/src/worker.ts`
