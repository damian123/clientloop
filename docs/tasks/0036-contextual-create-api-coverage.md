# 0036 - Contextual Create API Coverage

## Goal

Protect the API contracts used by contextual account, contact, and opportunity create flows.

## Completed

- [x] Added an API regression test for direct account creation.
- [x] Added an API regression test for direct contact creation under the new account.
- [x] Added an API regression test for direct opportunity creation tied to the account and contact.
- [x] Verified the created records appear in the dashboard response.

## Next

- Add browser-level coverage for the contextual New toolbar once a frontend test harness is adopted.
- Add permission-negative cases for create endpoints by role.
