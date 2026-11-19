# Changelog

## Unreleased

## 0.2.1 - 2026-11-19

- Preserve template-literal patterns and members of alternative allowlists in the false branch of
  `isOneOf`. Preserve potentially sparse arrays in the false branch of `isArrayOf`. JSON column
  preparation still validates ordinary arrays.
- Skip package builds for story Markdown changes unless the diff also changes a package input.

- Snapshot allowlists when constructing `isOneOf` validators so later changes to the source array
  cannot change what an existing validator accepts.
- Run the packed release in a Lucid SQLite consumer before publishing.

## 0.2.0 - 2026-11-16

- `jsonColumn` validates both a value and its JSON encoding. Under unchanged host validator rules,
  the encoded value passes the same read-side validation; sparse arrays, `NaN`, and shape-changing
  `toJSON` methods are rejected. Encoding errors such as `BigInt` and cycles are wrapped in
  `Cannot encode JSON in <table>.<column>` with the original error as `cause`.
- ISO predicates return distinct validated string subtypes and preserve sound false-branch types
  for mixed unions. `isOneOf` keeps exact literal inference while supporting dynamic and partially
  typed allowlists without unsound false-branch narrowing. Sparse arrays and allowlists reject
  absent elements.
- Lucid column hook types preserve value and return types with one- or three-argument hooks.
  JSON column markers survive inherited-column cloning and separately evaluated package copies.
- `check:changed` selects formatting, lint, type, test, and build checks from changed paths. It
  counts executed tests, passes dash-prefixed formatter paths literally, and invalidates formatting
  checks when formatter inputs change. Its process handling uses bounded deadline cleanup, framed
  PID records, readiness checks, and complete child output; Git spawn, signal, and exit failures
  retain their diagnostics. The runner removes its unused clean-tree option and unconsumed
  cleanup-result plumbing while keeping cleanup failures in internal diagnostics.
- Release readiness rejects an invalid SHA-256 checksum. Documentation now describes JSON text
  storage, host validation and subtype limits, ISO year boundaries, and Lucid dirty-tracking and
  query-builder limitations.

## 0.1.0 - 2026-11-13

First release.

- `jsonColumn(table, column, validate)`: Lucid column options that store a property as JSON text
  and refuse an invalid value on write and on read.
- Validators `isBoolean`, `isOneOf` and `isArrayOf`.
- `isJsonColumn(options)`: whether a model column was declared with `jsonColumn`.
- `isoDateColumn(table, column)` and `isoTimestampColumn(table, column)`: column options that keep
  a canonical `YYYY-MM-DD` date or UTC millisecond instant and refuse anything else, with the
  predicates `isIsoDate` and `isIsoTimestamp`.
