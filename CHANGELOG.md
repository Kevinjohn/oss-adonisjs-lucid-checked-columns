# Changelog

## Unreleased

- `jsonColumn` validates a written value's JSON encoding as well as the value, so `prepare` never
  returns text that `consume` refuses (array holes, `NaN`, a shape-changing `toJSON`).
- `jsonColumn` wraps an encoding error (a `BigInt` or a cycle) in
  `Cannot encode JSON in <table>.<column>`, with the original as `cause`.

## 0.1.0 - 2026-11-13

First release.

- `jsonColumn(table, column, validate)`: Lucid column options that store a property as JSON text
  and refuse an invalid value on write and on read.
- Validators `isBoolean`, `isOneOf` and `isArrayOf`.
- `isJsonColumn(options)`: whether a model column was declared with `jsonColumn`.
- `isoDateColumn(table, column)` and `isoTimestampColumn(table, column)`: column options that keep
  a canonical `YYYY-MM-DD` date or UTC millisecond instant and refuse anything else, with the
  predicates `isIsoDate` and `isIsoTimestamp`.
