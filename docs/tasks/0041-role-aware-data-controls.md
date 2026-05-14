# 0041 - Role-Aware Data Controls

## Goal

Expose session permissions to the web app and use them to prevent bulk data actions that the API would reject.

## Completed

- [x] Added permission metadata to the shared session contract.
- [x] Returned flattened role permissions from `/v1/session` and `/v1/session/dev-login`.
- [x] Updated the SDK session parser and tests for the expanded session payload.
- [x] Disabled export and contact import controls in the Data view when the active session lacks permission.
- [x] Kept client-side guards in the action handlers so disabled controls are not the only protection.

## Next

- Reuse the same session permissions for create buttons and record correction controls.
- Add component-level tests once the app has a browser-oriented test harness.
