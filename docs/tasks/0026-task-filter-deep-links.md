# 0026 - Task Filter Deep Links

## Goal

Make task queue filters survive refreshes and support shareable workspace links.

## Completed

- [x] Restored task queue status, owner, and due filters from URL parameters.
- [x] Updated task filter controls to write route state when filters change.
- [x] Omitted default filter values from the URL to keep links clean.
- [x] Preserved existing workspace `view` and `record` deep-link behavior.

## Next

- Add saved queue views once user preferences are persisted.
- Add a copy-link affordance after the task queue layout settles.
