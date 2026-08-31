# Limitations

Portfolio project using fictional data. It is not connected to an employer, client, or production system.

This repository demonstrates CRM architecture and control design. It is not a hosted product.

Before any production use, at least:

- Disable development authentication (`ALLOW_DEV_LOGIN`, `ALLOW_HEADER_AUTH`), configure the OIDC BFF flow, and validate provider-specific logout/session policies.
- Complete a threat model and privacy review.
- Configure managed secrets and durable infrastructure.
- Add monitoring, backup, recovery, and retention controls.
- Do not import real prospect, customer, or employer data.

The in-memory repository is for tests and local demos. PostgreSQL is the intended durable store.
The GraphQL endpoint is a bounded read model for record-detail screens, not a general replacement for the REST write API.
