# 0040 - Bulk Data Permission Coverage

## Goal

Require explicit permissions for bulk data export and import preview workflows.

## Completed

- [x] Added API coverage that rejects contact CSV export for a rep without export permission.
- [x] Added API coverage that rejects contact import preview for a rep without contact create permission.
- [x] Enforced contact create permission before parsing contact import preview payloads.
- [x] Expanded import workflows to accounts and opportunities after the contact path stabilized.

## Next

- Add negative permission coverage for account and opportunity import endpoints if roles become more granular than the current manager workflow.
