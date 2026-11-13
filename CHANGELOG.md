# Changelog

## Unreleased

## 0.1.0 - 2026-11-13

First release.

- `jsonColumn(table, column, validate)`: Lucid column options that store a property as JSON text
  and refuse an invalid value on write and on read.
- Validators `isBoolean`, `isOneOf` and `isArrayOf`.
- `isJsonColumn(options)`: whether a model column was declared with `jsonColumn`.
- `isoDateColumn(table, column)` and `isoTimestampColumn(table, column)`: column options that keep
  a canonical `YYYY-MM-DD` date or UTC millisecond instant and refuse anything else, with the
  predicates `isIsoDate` and `isIsoTimestamp`.
