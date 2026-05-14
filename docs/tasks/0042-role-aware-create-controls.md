# 0042 - Role-Aware Create Controls

## Goal

Reuse session permissions to prevent the web workspace from offering create actions that the API would reject.

## Completed

- [x] Added a tested web permission helper for session-derived create and bulk data capabilities.
- [x] Disabled the toolbar `New` command when the active view has no permitted create action.
- [x] Guarded account, contact, lead, and opportunity create open handlers with permission-aware messages.
- [x] Guarded account, contact, lead, and opportunity submit handlers so disabled controls are not the only protection.
- [x] Kept the Data view without a contextual create action.

## Next

- Apply the same permission model to the task queue edit and complete actions.
- Add a browser component test harness for permission-aware UI states.
