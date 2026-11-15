# Decision gaps

None was identified between the [README](../README.md), the [changelog](../CHANGELOG.md) and the [source](../src/) during this catalogue pass. No separate product decision record is present. The following boundaries are retained intentionally, not unresolved feature requests.

| Boundary             | Contract and source                                                                                                                   | Catalogue treatment                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Model path only      | Lucid runs `prepare` and `consume` for model reads and writes only; query-builder writes bypass them ([README](../README.md#limits)). | US-COLUMN-01/02 cover model saves and hydration; US-COLUMN-03 helps host code that writes outside the model but does not validate for it. |
| Reject, never repair | The helpers refuse rather than repair a value ([README](../README.md#limits), [ISO columns](../src/iso_column.ts)).                   | US-COLUMN-02 requires the driver and column type to return the canonical string; a driver that returns a `Date` is refused on read.       |
| Driver behaviour     | The model test uses an in-memory adapter ([tests](../tests/json_column.spec.ts)); no database driver is exercised.                    | Stories describe the column hooks, not any driver's encoding of JSON or date columns.                                                     |
