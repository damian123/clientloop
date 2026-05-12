# 0016 - Detail Activity Logging

## Goal

Let users log calls, emails, meetings, and events from an active record detail panel, then show recent activity for that record and in the global activity timeline.

## Completed

- [x] Added a create activity contract and SDK method.
- [x] Added `POST /v1/activities` to the API.
- [x] Implemented activity creation in the in-memory and Prisma repositories.
- [x] Added activity state to the web workspace.
- [x] Added an activity composer to record detail panels.
- [x] Added recent activity display scoped to the active record.
- [x] Updated the global timeline to use live activity state.

## Next

- Add a unified record timeline that merges notes, tasks, and activities.
- Add richer activity payload fields by activity type.
