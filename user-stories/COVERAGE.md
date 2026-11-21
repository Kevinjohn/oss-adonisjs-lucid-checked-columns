# Capability coverage

“New” means newly documented, not newly implemented. Test links identify useful source evidence; no runtime tests were run for this catalogue.

| Story                                                       | Action                                                                                                                       | Access                         | Status  | Catalogue |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------- | --------- |
| [US-COLUMN-01](US-COLUMN-01-store-checked-json.md)          | Store a property as JSON, validated on save and on read                                                                      | Model saves and hydration      | Current | New       |
| [US-COLUMN-02](US-COLUMN-02-store-iso-date-or-timestamp.md) | Keep a `YYYY-MM-DD` date string, or a UTC timestamp string with three fractional-second digits and a trailing `Z`, unchanged | Model saves and hydration      | Current | New       |
| [US-COLUMN-03](US-COLUMN-03-find-json-columns.md)           | Tell whether a model column was declared with `jsonColumn`                                                                   | Host code with the model class | Current | New       |

Public exports mapped: `jsonColumn`, `isBoolean`, `isOneOf`, `isArrayOf`, `JsonColumnOptions` and `JsonValidator` (US-COLUMN-01); `isoDateColumn`, `isoTimestampColumn`, `isIsoDate`, `isIsoTimestamp` `IsoColumnOptions`, `IsoDate` and `IsoTimestamp` (US-COLUMN-02); `isJsonColumn` (US-COLUMN-03). The package has root and `./types` export paths, no provider and no `configure` hook. No prior story catalogue existed; all rows are newly documented.
