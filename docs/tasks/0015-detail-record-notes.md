# 0015 - Detail Record Notes

## Goal

Let users capture plain-text notes from an active record detail panel and see recent notes without leaving the CRM workspace.

## Completed

- [x] Added notes to web workspace state from the dashboard payload.
- [x] Wired note creation through the existing authenticated API client.
- [x] Added local fallback note creation for seed-only UI mode.
- [x] Added a note composer to account, contact, lead, and opportunity detail panels.
- [x] Added recent note display scoped to the active record.
- [x] Added compact shared styling for note and task composition.

## Next

- Add activity logging for calls, meetings, and emails.
- Add a unified record timeline that merges notes, tasks, and activities.
