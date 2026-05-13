# 0024 - Task Queue Editing

## Goal

Let users correct task details directly from the main work queue, not only from record timelines.

## Completed

- [x] Added edit controls to task queue items.
- [x] Reused the existing optimistic task update API and SDK flow.
- [x] Allowed queue edits for title, description, due date, and priority.
- [x] Kept the complete action available next to edit for open tasks.

## Next

- Add task queue filters by status, owner, and due date.
- Add a dedicated full-history drawer with pagination once timelines need server-backed history loading.
