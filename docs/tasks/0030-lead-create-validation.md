# 0030 - Lead Create Validation

## Goal

Make the toolbar lead creation form explain optional email format errors before the API rejects the request.

## Completed

- [x] Added client-side validation for optional lead email input.
- [x] Disabled lead creation while the email value is malformed.
- [x] Added inline validation messaging.
- [x] Kept blank email valid for leads that do not have a known address yet.

## Next

- Add contextual create forms for accounts, contacts, and opportunities.
- Add shared form validation helpers once more create forms exist.
