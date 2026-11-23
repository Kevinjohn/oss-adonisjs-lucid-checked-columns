# US-COLUMN-05 — Use the installed package from a typed Lucid model

As an application developer, I want to import the published hooks and types into a Lucid model so my application can typecheck its declarations and read back what it writes.

**Status:** Current.
**Access and entry:** An ESM application using the Node and Lucid versions in the [package manifest](../package.json). Install the [release tarball](../README.md#install) or a tarball built from current source, import runtime helpers from `@kevinjohn/adonisjs-lucid-checked-columns` and apply them with Lucid’s `@column`. The public type entry is available since v0.3.0.

## Acceptance criteria

- The root exports runtime helpers and types. The `/types` subpath supports type-only imports of `IsoDate`, `IsoTimestamp`, `IsoColumnOptions`, `JsonColumnOptions` and `JsonValidator`. Both entry points refer to the same declarations and brands.
- A successful ISO predicate check lets the host assign the resulting branded value across either entry point. Hook declarations typecheck their write inputs even when Lucid attribute and model arguments are supplied. `consume` accepts unknown driver input.
- With a configured Lucid adapter and suitable SQLite text columns, creating a record writes JSON text and canonical ISO strings. Finding the record hydrates the array and returns the original ISO strings. No package-specific provider or configuration hook is needed.
- A model save with an invalid date fails. A direct database write can store malformed JSON. The next model read then fails during hydration.

## User flow

```mermaid
flowchart TD
    A["Declare model with installed hooks"] --> B["Create a record"]
    B --> C{"Accepted column values?"}
    C -->|Yes| D["Read the stored record through Lucid"]
    C -->|No| E["Save reports the invalid column"]
    D --> F{"Stored data passes hydration?"}
    F -->|Yes| G["Use hydrated properties"]
    F -->|No| H["Read reports the invalid column"]
```

## Code flow

Scope: the packed SQLite consumer's sequential assertions, including its expected refusal cases.

```mermaid
flowchart TD
    A["Smoke script copies fixture and candidate tarball into temporary directory"] --> B["pnpm install"]
    B --> C["pnpm smoke: tsc then node build/model.js"]
    C --> D["Configure SQLite adapter and declare ReleaseRecord"]
    D --> E["Create text columns and check ISO values"]
    E --> F["ReleaseRecord.create runs column prepare hooks"]
    F --> G["db.from checks raw text storage"]
    G --> H["ReleaseRecord.findOrFail runs consume hooks"]
    H --> I["Assert JSON metadata and hydrated properties"]
    I --> J["Assert create rejects invalid date"]
    J --> K["db.from update stores malformed JSON without hooks"]
    K --> L["Assert findOrFail rejects malformed JSON"]
    L --> M["Report successful smoke check"]
    M --> N["Finally close database connections"]
```

The [packed consumer](../examples/release-consumer/model.ts) closes the database in `finally` after the model assertions, also on failure. The [smoke script](../bin/release_consumer_smoke.sh) removes the temporary fixture on shell exit. [Smoke command](../examples/release-consumer/package.json), [root exports](../index.ts) and [type entry](../src/types.ts).
