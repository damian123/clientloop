# 0034 - Create Input Regression Coverage

## Goal

Move contextual create input builders into a testable module and cover validation behavior.

## Completed

- [x] Extracted account, contact, lead, and opportunity draft/input builders from the workspace component.
- [x] Added Vitest coverage for trimming, omitted optional fields, email validation, numeric parsing, and invalid opportunity values.
- [x] Kept the existing workspace UI wired to the same helper names.

## Next

- Extract shared create-form layout primitives for the four contextual create forms.
- Add browser-level regression coverage once the project adopts a frontend test harness.
