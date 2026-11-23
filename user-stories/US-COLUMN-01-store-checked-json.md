# US-COLUMN-01 — Store a checked JSON property

As an application developer, I want a model property stored as JSON and checked against a type predicate when it is written and when it is read so that an invalid value is refused when Lucid runs its column hooks and a corrupt row fails hydration instead of reaching the application.

**Status:** Current.
**Access:** Application developer who declares the Lucid model. Applies to model saves and model hydration only.
**Entry:** `@column(jsonColumn(table, column, acceptsValue))` on a Lucid model property, with a type predicate such as `isBoolean`, one returned by `isOneOf(values)` or `isArrayOf(acceptsValue)`, or any host type predicate.
**Documentation:** [Use](../README.md#use), [API](../README.md#api), [Errors](../README.md#errors), [Limits](../README.md#limits).
**Source:** [JSON column](../src/json_column.ts).
**Coverage:** [JSON column tests](../tests/json_column.spec.ts).

## Acceptance criteria

| Input          | Control    | Required/default/conditions                                                                                                                                                                                                                                                                                          |
| -------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `table`        | Argument 1 | Required string. Table name used only in error messages.                                                                                                                                                                                                                                                             |
| `column`       | Argument 2 | Required string. Column name used only in error messages.                                                                                                                                                                                                                                                            |
| `acceptsValue` | Argument 3 | Required TypeScript type predicate `(value: unknown) => value is T`. Use `isBoolean` for booleans, the type predicate returned by `isOneOf(values)` for listed strings or numbers, the one returned by `isArrayOf(acceptsValue)` to apply another type predicate to every array element, or your own type predicate. |

- On save, an accepted non-null value is written as `JSON.stringify(value)`. On read, every string is parsed with `JSON.parse`; a non-string value from the driver is validated as it is. A direct `null` input passes through either hook without validation; JSON text `null` is parsed and validated like other text.
- The stored representation is JSON text, suitable for a text column. A decoded native scalar string is not supported: strings are always parsed as JSON, with no parse-error fallback. The packed consumer verifies SQLite text storage; other driver encodings are not claimed.
- On save, a non-null value must pass `acceptsValue` both before encoding and after its JSON text is parsed back, so under unchanged host validation rules whatever is written can be read back. If either check fails, the save throws `Invalid persisted JSON in <table>.<column>` and nothing is written. Read-side validation still runs for every read.
- After a value passes `acceptsValue`, an encoding that returns `undefined` (a function, for example) throws `Cannot persist undefined JSON in <table>.<column>`, and an encoding that throws (a `BigInt` or a cycle) throws `Cannot encode JSON in <table>.<column>` with the original error as `cause`.
- On read, text that is not JSON, or a decoded value that fails `acceptsValue`, throws `Invalid persisted JSON in <table>.<column>`; the row does not hydrate.
- An exception thrown by the host predicate propagates unchanged during either write-side check or the read-side check. Only an exception during encoding is wrapped with a cause.
- The helper refuses an invalid value rather than repairing it; beyond JSON encoding on save and parsing on read, it changes nothing. Query-builder writes bypass it.
- Lucid can skip an update before `prepare` runs when a top-level object value owns an `isDirty: false` property. Avoid that key for top-level object values in model saves; resolving arbitrary keys requires Lucid dirty-tracking changes.

## User flow

```mermaid
flowchart TD
    A["Developer declares the property with jsonColumn and a type predicate"] --> B{"Saving or reading the model?"}
    B -->|Saving| S{"Does Lucid run prepare?"}
    S -->|No| T["Update may be skipped"]
    S -->|Yes| C{"null, or a value that can be stored as valid JSON?"}
    C -->|No| D["Save fails; nothing is written by the save"]
    C -->|Yes| E["JSON text or null is stored"]
    B -->|Reading| F{"null, or stored data that passes the JSON checks?"}
    F -->|No| G["Read fails; the row does not reach the application"]
    F -->|Yes| H["Application receives the validated value or null"]
```

## Code flow

Scope: the column options Lucid calls on model save (`prepare`) and hydration (`consume`); queries that bypass the model are host-owned.

```mermaid
flowchart TD
    A["jsonColumn(table, column, acceptsValue)"] --> B["{ meta, prepare, consume }"]
    B --> P["prepare(value)"]
    P --> P1{"null?"}
    P1 -->|Yes| P2["return null"]
    P1 -->|No| P3{"acceptsValue(value)?"}
    P3 -->|False| I["throw Invalid persisted JSON"]
    P3 -->|Throws| X["propagate predicate error unchanged"]
    P3 -->|True| F["JSON.stringify(value)"]
    F -->|Throws| E["throw Cannot encode JSON with cause"]
    F -->|Returns| U{"encoded is undefined?"}
    U -->|Yes| N["throw Cannot persist undefined JSON"]
    U -->|No| R{"acceptsValue(JSON.parse(encoded))?"}
    R -->|False| I
    R -->|Throws from predicate| X
    R -->|True| P5["return encoded"]
    B --> C["consume(value)"]
    C --> C1{"null?"}
    C1 -->|Yes| P2
    C1 -->|No| C2{"value is a string?"}
    C2 -->|Yes| J["JSON.parse(value)"]
    J -->|Throws| I
    J -->|Returns| C3{"acceptsValue(parsed)?"}
    C2 -->|No: parsed = value| C3
    C3 -->|False| I
    C3 -->|Throws| X
    C3 -->|True| C5["return parsed"]
```

**Code references:** [jsonColumn](../src/json_column.ts#L79), [type predicates](../src/json_column.ts#L38), [JsonValidator](../src/types.ts#L10).
