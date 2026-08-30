# Limitations

Portfolio project using fictional data. It is not connected to an employer, client, or production system.

This repository demonstrates CRM architecture and control design. It is not a hosted product.

Before any production use, at least:

- Replace development authentication (`ALLOW_DEV_LOGIN`, `ALLOW_HEADER_AUTH`, and example secrets).
- Complete a threat model and privacy review.
- Configure managed secrets and durable infrastructure.
- Add monitoring, backup, recovery, and retention controls.
- Do not import real prospect, customer, or employer data.

The in-memory repository is for tests and local demos. PostgreSQL is the intended durable store.
