# 0028 - Dashboard Refresh

## Goal

Make the visible Refresh toolbar action reload CRM workspace data without losing the current view, selected record, or task filters.

## Completed

- [x] Wired the Refresh button to the typed dashboard API client.
- [x] Replaced dashboard-backed accounts, contacts, leads, opportunities, tasks, notes, activities, and custom field definitions after refresh.
- [x] Preserved URL-backed workspace state during refresh.
- [x] Reused toolbar feedback for refresh success and errors.
- [x] Kept seed-only mode functional by reapplying the initial dashboard payload.

## Next

- Add automatic stale-data indicators once background sync or polling is introduced.
- Add toast-style shared feedback if more toolbar actions need transient status messages.
