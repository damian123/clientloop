# 0040 - Bulk Data Permission Coverage

## Goal

Require explicit permissions for bulk data export and contact import preview workflows.

## Completed

- [x] Added API coverage that rejects contact CSV export for a rep without export permission.
- [x] Added API coverage that rejects contact import preview for a rep without contact create permission.
- [x] Enforced contact create permission before parsing contact import preview payloads.

## Next

- Add UI affordance checks once the frontend receives role-aware permission state.
- Add account and opportunity import workflows only after the contact path remains stable.
