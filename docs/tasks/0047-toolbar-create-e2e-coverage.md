# 0047 - Toolbar Create E2E Coverage

## Goal

Cover role-aware contextual `New` toolbar states in the browser test harness.

## Completed

- [x] Added a positive browser scenario for the Sales Rep session across Pipeline, Leads, Accounts, and Contacts.
- [x] Added a Data view assertion where contextual `New` stays disabled by view rules.
- [x] Added a no-create session scenario that keeps contextual `New` disabled even in Pipeline.
- [x] Tightened the toolbar button locator to avoid matching unrelated action buttons.

## Next

- Add browser coverage for timeline creation and correction controls.
- Add browser coverage for task queue edit and complete controls.
