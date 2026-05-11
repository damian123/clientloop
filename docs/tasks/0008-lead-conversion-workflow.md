# Task 0008: Lead Conversion Workflow

## Goal

Add a first-class CRM command for converting qualified leads into canonical account, contact, and optional opportunity records.

## Checklist

- [x] Add shared conversion contracts and OpenAPI route metadata.
- [x] Add domain rule coverage for lead conversion state and version checks.
- [x] Implement conversion in the in-memory and Prisma repositories.
- [x] Expose `POST /v1/leads/:id/convert` through the API and SDK.
- [x] Add a Leads view to the CRM workspace with a conversion action.
- [x] Emit created-record and `lead.converted` outbox events.
- [x] Cover conversion behavior with API tests.

## Notes

- The web UI creates a prospect account, contact, and pipeline opportunity from each converted lead.
- Conversion uses optimistic concurrency, so stale lead rows return a conflict instead of silently overwriting state.
