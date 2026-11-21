# User story catalogue

Source baseline: `2c6247d73329dba4273a20e1da51206ccc056947` (origin/main, 2026-11-14). Scope: the public exports in `index.ts`: the checked JSON column and its type predicates, the ISO date and timestamp columns and their predicates, and the JSON column check. Source-reviewed only; no runtime journeys were exercised for this catalogue.

## Index

| Story                                                       | Action                                                   | Status  |
| ----------------------------------------------------------- | -------------------------------------------------------- | ------- |
| [US-COLUMN-01](US-COLUMN-01-store-checked-json.md)          | Store a checked JSON property                            | Current |
| [US-COLUMN-02](US-COLUMN-02-store-iso-date-or-timestamp.md) | Store a checked ISO date or timestamp                    | Current |
| [US-COLUMN-03](US-COLUMN-03-find-json-columns.md)           | Find a model's JSON columns for writes outside the model | Current |

## Files

- [Template and maintenance rules](TEMPLATE.md)
- [Roles, interfaces and source map](REFERENCE.md)
- [Capability coverage](COVERAGE.md)
- [Decision gaps](GAPS.md)
