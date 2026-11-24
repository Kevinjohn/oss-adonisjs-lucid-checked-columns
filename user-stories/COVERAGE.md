# Capability coverage

All five stories existed before this refresh. Current describes source availability under the stated conditions, not a runtime test result. No additional independently useful action was found in the public exports or package setup.

| Story                                                       | Action and public interface                                                                                           | Access                                                            | Status  | Catalogue |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------- | --------- |
| [US-COLUMN-01](US-COLUMN-01-store-checked-json.md)          | Store and hydrate checked JSON: `jsonColumn`, `JsonColumnOptions`, JSON error classes                                 | Developer declaring a Lucid model; hooks run on model paths       | Current | Existing  |
| [US-COLUMN-02](US-COLUMN-02-store-iso-date-or-timestamp.md) | Store and hydrate canonical dates and timestamps: ISO columns, predicates, options, branded types and ISO error class | Developer declaring a Lucid model; hooks run on model paths       | Current | Existing  |
| [US-COLUMN-03](US-COLUMN-03-find-json-columns.md)           | Identify JSON metadata: `isJsonColumn`                                                                                | Developer with model column options; raw writes remain host-owned | Current | Existing  |
| [US-COLUMN-04](US-COLUMN-04-compose-json-predicates.md)     | Validate values with `isBoolean`, `isOneOf`, `isArrayOf` and host `JsonValidator`                                     | Developer; no model required                                      | Current | Existing  |
| [US-COLUMN-05](US-COLUMN-05-consume-installed-package.md)   | Install a source candidate and use root and `/types` exports with Lucid                                               | ESM consumer with manifest prerequisites and a suitable adapter   | Current | Existing  |

The package provides no provider, mixin, configuration hook, schema API or authorization policy. The host chooses schema, access, error handling and direct database writes. Error class names and `E_...` aliases describe the same constructors; their codes and messages are diagnostics for the column actions rather than separate actions.
