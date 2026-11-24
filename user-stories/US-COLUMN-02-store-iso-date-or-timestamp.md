# US-COLUMN-02 — Store a checked ISO date or timestamp

As an application developer, I want a date or timestamp property kept as one canonical string in both directions so that a value in any other form is refused rather than silently converted between time zones or formats.

**Status:** Current.
**Access:** Application developer who declares the Lucid model. Applies to model saves and model hydration only.
**Entry:** `@column(isoDateColumn(table, column))` or `@column(isoTimestampColumn(table, column))` on a Lucid model property. `isIsoDate(value)` and `isIsoTimestamp(value)` return true for a string in the accepted format and false otherwise, including for `null`; the column helpers pass `null` through.
**Documentation:** [Use](../README.md#use), [API](../README.md#api), [Errors](../README.md#errors), [Limits](../README.md#limits).
**Source:** [ISO columns](../src/iso_column.ts).
**Coverage:** [ISO column tests](../tests/iso_column.spec.ts).

## Acceptance criteria

| Input    | Control        | Required/default/conditions                                                                                                                                                              |
| -------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `table`  | Argument 1     | Required string. Table name exposed on exceptions and in their diagnostics.                                                                                                              |
| `column` | Argument 2     | Required string. Column name exposed on exceptions and in their diagnostics.                                                                                                             |
| `T`      | Type parameter | Optional; defaults to `string`. A host string subtype for the property; it is a compile-time assertion and adds no runtime check for rules beyond the helper's canonical ISO validation. |

- `isoDateColumn` accepts only a real calendar date written `YYYY-MM-DD`; years 0001 through 9999, month lengths and Gregorian leap years are checked without depending on the host time zone.
- `isoTimestampColumn` accepts only a string `Date#toISOString()` produces: a UTC instant with three millisecond digits and a trailing `Z`.
- Standalone type predicates narrow successful input to `IsoDate` or `IsoTimestamp`. A failed type predicate check leaves ordinary strings possible. Canonical timestamps can include year 0000 or a signed six-digit extended year if the instant round-trips exactly.
- An accepted value is stored and returned unchanged. `null` passes through both ways.
- Any other value, including a `Date`, a Luxon `DateTime`, an instant with an offset or a non-string value from the driver, throws `errors.E_INVALID_ISO_COLUMN_VALUE` with the table, column and format kind on save or on read. Nothing is saved, or the row does not hydrate.
- The helpers refuse an invalid value rather than repairing or converting it. Query-builder writes bypass them.

## User flow

```mermaid
flowchart TD
    A["Developer declares the property with isoDateColumn or isoTimestampColumn"] --> B["Model saves or reads the property"]
    B --> C{"null or the canonical string?"}
    C -->|Yes| D["Value is stored or returned unchanged"]
    C -->|No| E["Save or read fails naming the column; correct the value or stored data"]
```

## Code flow

The standalone predicates return booleans. Lucid calls the two hooks on model save and hydration, where the same predicates check non-null values.

```mermaid
flowchart TD
    S["Call isIsoDate or isIsoTimestamp directly"] --> R["Return whether the input is canonical"]
    A["isoDateColumn or isoTimestampColumn(table, column)"] --> B["createIsoColumnOptions with table, column, kind and acceptsValue"]
    B --> C["prepare and consume are the same function"]
    C --> D{"value === null?"}
    D -->|Yes| E["return null"]
    D -->|No| F{"acceptsValue(value)?"}
    F -->|No| G["throw E_INVALID_ISO_COLUMN_VALUE"]
    F -->|Yes| H["return value unchanged"]
```

The date predicate checks the string type, four-digit date pattern, year/month/day ranges and leap-year-adjusted month length, in that order. The timestamp predicate checks the string type, a finite `Date.parse` result and exact equality with its ISO encoding.

**Code references:** [isoDateColumn](../src/iso_column.ts#L82), [isoTimestampColumn](../src/iso_column.ts#L105), [shared hooks](../src/iso_column.ts#L52), [isIsoDate](../src/iso_column.ts#L15), [isIsoTimestamp](../src/iso_column.ts#L38).
