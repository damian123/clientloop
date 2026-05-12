# 0013 - Workspace Deep Links

## Goal

Make workspace view and record detail state URL-backed so users can refresh or share a focused CRM screen without losing the active list and selected record.

## Completed

- [x] Added `view` query parameter support for workspace navigation.
- [x] Added `record` query parameter support for account, contact, lead, and opportunity detail panels.
- [x] Restored view and selected detail state from URL parameters on page load.
- [x] Updated record open actions to write shareable URLs.
- [x] Updated detail close behavior to remove only the active record parameter.
- [x] Wrapped the client workspace in a Suspense boundary for Next.js search parameter support.

## Next

- Add task and activity composition from the active detail panel.
- Add copy-link affordance after routes settle into the final UX.
