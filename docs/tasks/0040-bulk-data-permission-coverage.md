# 0040 - Bulk Data Permission Coverage

## Goal

Require explicit permissions for bulk data export and import preview workflows.

## Completed

- [x] Added API coverage that rejects contact CSV export for a rep without export permission.
- [x] Added API coverage that rejects contact import preview for a rep without contact create permission.
- [x] Enforced contact create permission before parsing contact import preview payloads.
- [x] Expanded import workflows to accounts and opportunities after the contact path stabilized.
- [x] Added negative API coverage for account, contact, and opportunity import preview and commit endpoints.

## Next

- Add browser-level negative coverage for the expanded import cards if the Data view gains a dedicated limited-import role.
