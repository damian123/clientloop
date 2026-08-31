# Security

Portfolio project using fictional data. It is not connected to an employer, client, or production system.

## Reporting a vulnerability

If you find a vulnerability in this repository, open a [GitHub security advisory](https://github.com/damian123/clientloop/security/advisories/new) or email the account owner through GitHub. Do not file a public issue for credential or data-exposure reports.

Please include:

- the affected path or workflow
- steps to reproduce
- impact if the project were run as published

There is no bug bounty.

## Non-goals

Development authentication (`ALLOW_DEV_LOGIN`, `ALLOW_HEADER_AUTH`, and example secrets in `.env.example`) is for local demonstration only. Treat those values as public. For a real deployment, disable both development paths, configure the OIDC authorization-code flow with a confidential client and HTTPS callback, rotate every example secret, and perform a provider-specific threat review. Do not point this codebase at live inboxes, CRMs, or identity providers without replacing secrets and infrastructure.

## Authentication boundaries

- Credentialed CORS uses exact `CORS_ALLOWED_ORIGINS` entries. Wildcards, URL paths, and production allow-by-default behavior are rejected.
- OIDC users are identified by the exact tenant, issuer, and subject binding. Verified email is available only behind the temporary `OIDC_ALLOW_EMAIL_LINKING` migration switch; leave it disabled during normal operation.
- `SESSION_SIGNING_SECRET`, `OIDC_TRANSACTION_SECRET`, and `WEBHOOK_SIGNING_SECRET` protect different trust domains and should be independently generated and rotated. A webhook secret is never accepted for session or OIDC transaction signing.
