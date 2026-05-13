# 0033 - Contextual Opportunity Create

## Goal

Make the New toolbar action create opportunities directly from the Pipeline view.

## Completed

- [x] Added an opportunity creation draft and submit handler.
- [x] Wired New to open opportunity creation when the Pipeline view is active.
- [x] Created opportunities through the existing typed API client.
- [x] Added a seed-only fallback for local demo mode.
- [x] Opened the new opportunity detail panel after creation.
- [x] Validated amount and probability before enabling submit.

## Next

- Extract shared create-form primitives for account, contact, lead, and opportunity forms.
- Add a focused integration or browser-level regression test for contextual New behavior.
