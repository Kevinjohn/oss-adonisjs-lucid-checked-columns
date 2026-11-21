# US-COLUMN-03 — Find a model's JSON columns for writes outside the model

As an application developer, I want to tell which model columns were declared with `jsonColumn` so that code writing rows without the model, such as an import or a raw insert, can encode those columns the way the model would.

**Status:** Current.
**Access:** Application developer with access to the model class.
**Entry:** `isJsonColumn(Model.$getColumn(propertyName))`, where `propertyName` is the model property name, not the database column name.
**Documentation:** [API](../README.md#api), [Limits](../README.md#limits).
**Source:** [JSON column](../src/json_column.ts).
**Coverage:** [isJsonColumn tests](../tests/json_column.spec.ts).

## Acceptance criteria

| Input     | Control    | Required/default/conditions                                                                           |
| --------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `options` | Argument 1 | The column's options from `Model.$getColumn(propertyName)`; `undefined` (no such column) is accepted. |

- Returns true only for a column whose options came from `jsonColumn`.
- Returns false for any other column, and for `undefined`.
- It reports the declaration only. Encoding and validating the value for a write outside the model stay with the host, which can call the column's own `prepare`.

## User flow

```mermaid
flowchart TD
    A["Host code prepares a row to write outside the model"] --> B["Look up each column on the model"]
    B --> C{"Declared with jsonColumn?"}
    C -->|Yes| D["Encode the value as the model would before writing"]
    C -->|No| E["Write the value as the column expects"]
```

## Code flow

Scope: package declaration check; the write itself is host-owned.

```mermaid
flowchart TD
    A["isJsonColumn(options)"] --> B{"options?.meta?.checkedColumns matches package marker?"}
    B -->|Yes| C["return true"]
    B -->|No| D["return false"]
```

**Code references:** [isJsonColumn](../src/json_column.ts#L125), [JSON_COLUMN marker](../src/json_column.ts#L10).
