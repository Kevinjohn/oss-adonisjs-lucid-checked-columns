# Reference

## Actors and boundaries

- **Application developer**: declares Lucid model properties with the column helpers and chooses each JSON type predicate. The package provides no provider, routes, UI or `configure` hook.
- **Lucid**: calls a column's `prepare` when a model is saved and `consume` when a model is hydrated from a row. Query-builder writes do not call them.

## Shared source map

- Public exports: [`index.ts`](../index.ts).
- JSON column, type predicates and the JSON column check: [`src/json_column.ts`](../src/json_column.ts).
- ISO date and timestamp columns and predicates: [`src/iso_column.ts`](../src/iso_column.ts).
- Installed consumer contracts and paths: [type entry](../types.ts), [manifest](../package.json), [packed SQLite fixture](../examples/release-consumer/model.ts).
- Contracts, error messages and limits: [README](../README.md). There is no separate guide.
- Test evidence: [`tests/json_column.spec.ts`](../tests/json_column.spec.ts), [`tests/iso_column.spec.ts`](../tests/iso_column.spec.ts).

## Availability

`Current` means implemented and available under each story's Access and Entry conditions; it does not mean runtime-verified. JSON and ISO predicates can be called directly without declaring a model column. Errors created by the column helpers are plain `Error` objects naming `<table>.<column>`; the `table` and `column` arguments are used only for these messages. An exception thrown by a supplied JSON type predicate propagates unchanged.

## Availability definitions

- **Current:** callable under the stated model and driver conditions; not a test result.
- **Hidden:** implementation remains but its ordinary entry or trigger is unavailable.
- **Removed:** historical capability has no current product entry.
- **Demo:** available only in a named demo context.
- **Operator:** installation or maintenance outside ordinary application requests.
- **Planned:** agreed target without an ordinary implemented journey.

The source baseline passed TypeScript checking and the repository’s 74 tests, including in-memory Lucid model journeys. The installed SQLite consumer was reviewed from source for this catalogue update. See the [portable template](TEMPLATE.md) for writing and diagram maintenance rules.
