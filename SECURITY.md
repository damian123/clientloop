# Security

ClientLoop is a synthetic portfolio scaffold. It is not a hosted product and is not intended for production use with real customer, prospect, or payment data.

## Reporting a vulnerability

If you find a vulnerability in this repository, open a [GitHub security advisory](https://github.com/damian123/clientloop/security/advisories/new) or email the account owner through GitHub. Do not file a public issue for credential or data-exposure reports.

Please include:

- the affected path or workflow
- steps to reproduce
- impact if the project were run as published

There is no bug bounty.

## Non-goals

Development authentication (`ALLOW_DEV_LOGIN`, `ALLOW_HEADER_AUTH`, and example secrets in `.env.example`) is for local demonstration only. Treat those values as public. Do not point this codebase at live inboxes, CRMs, or identity providers without replacing auth, secrets, and infrastructure.
