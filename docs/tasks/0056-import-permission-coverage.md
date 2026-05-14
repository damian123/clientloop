# 0056 - Import Permission Coverage

## Goal

Make the expanded CSV import surface fail closed for users without matching create permissions.

## Completed

- [x] Removed account, contact, and opportunity create permissions from a test Sales Rep role.
- [x] Asserted account import preview and commit return `403`.
- [x] Asserted contact import preview and commit return `403`.
- [x] Asserted opportunity import preview and commit return `403`.

## Next

- Add browser-level negative coverage if the product introduces a limited data-operator role.
