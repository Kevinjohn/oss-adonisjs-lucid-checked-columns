# @kevinjohn/adonisjs-lucid-checked-columns

Checked JSON, ISO date and ISO timestamp columns for AdonisJS Lucid models. Each helper returns
`prepare`/`consume` options for Lucid's `@column` decorator that refuse an invalid value in both
directions, so a corrupt row fails loudly when it is read instead of reaching the application.

Requires Node 24 or later and `@adonisjs/lucid` 22.

## Install

Releases are GitHub release tarballs; the package is not on the npm registry.

```sh
pnpm add https://github.com/Kevinjohn/oss-adonisjs-lucid-checked-columns/releases/download/v0.2.1/kevinjohn-adonisjs-lucid-checked-columns-0.2.1.tgz
```

There is no provider and nothing to configure.

## Use

```ts
import { BaseModel, column } from '@adonisjs/lucid/orm'
import {
  isArrayOf,
  isBoolean,
  isOneOf,
  isoDateColumn,
  isoTimestampColumn,
  jsonColumn,
} from '@kevinjohn/adonisjs-lucid-checked-columns'

export default class Hero extends BaseModel {
  static table = 'heroes'

  @column({ isPrimary: true })
  declare id: number

  @column(jsonColumn('heroes', 'active', isBoolean))
  declare active: boolean

  @column(jsonColumn('heroes', 'teams', isArrayOf(isOneOf(['Justice League', 'Titans'] as const))))
  declare teams: ('Justice League' | 'Titans')[]

  @column(isoDateColumn('heroes', 'first_appeared_on'))
  declare firstAppearedOn: string | null

  @column(isoTimestampColumn('heroes', 'created_at'))
  declare createdAt: string
}
```

The `table` and `column` arguments only name the column in error messages.

## API

| Export                                      | Behaviour                                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jsonColumn(table, column, validate)`       | Writes `JSON.stringify(value)`; reads with `JSON.parse` when the driver returns text. `null` passes through. The value must pass `validate` both ways.                                                  |
| `isBoolean`                                 | Type predicate: `true` or `false`.                                                                                                                                                                      |
| `isOneOf(values)`                           | Type predicate: exactly one of the listed strings or numbers.                                                                                                                                           |
| `isArrayOf(validate)`                       | Type predicate: an array whose every element passes `validate`.                                                                                                                                         |
| `isJsonColumn(options)`                     | Whether a column was declared with `jsonColumn`. Pass `Model.$getColumn(name)`; use it to find the JSON columns when writing rows outside the model.                                                    |
| `isoDateColumn(table, column)`              | Keeps a real calendar date written `YYYY-MM-DD` in years `0001`–`9999` unchanged; refuses anything else. `null` passes through.                                                                         |
| `isoTimestampColumn(table, column)`         | Keeps a UTC instant exactly as `Date#toISOString()` writes it (three millisecond digits, trailing `Z`), including its signed six-digit extended-year form outside `0000`–`9999`; refuses anything else. |
| `isIsoDate(value)`, `isIsoTimestamp(value)` | The predicates the two ISO helpers use.                                                                                                                                                                 |

`jsonColumn` stores JSON text, so use a text column for this representation. On read, every string
is parsed as JSON before validation. A decoded native scalar string is ambiguous with encoded JSON
text: for example, the string `true` parses as the boolean `true`, while `red` is not valid JSON.
Decoded scalar strings from native JSON columns are not a supported representation; the helper does
not fall back to treating unparseable text as a decoded string. This documents the helper's value
contract. Release CI additionally installs the packed package into a Lucid SQLite consumer and
checks real saves and hydration using text columns; no equivalent test claim is made for other drivers.

On write, the value and its JSON encoding are both checked. The encoded text passes read-side
validation under unchanged host validation rules; the read side continues to validate each value.

Any `(value: unknown) => value is T` function is a type predicate, so a host can supply its own.
`isoDateColumn<T>` and `isoTimestampColumn<T>` accept a host string type for the property.
The generic is a compile-time assertion: the helpers still check canonical ISO syntax, but cannot
prove additional rules encoded in a host subtype. For example, the host must check a business cutoff
before assigning a branded type:

```ts
type PostLaunchDate = string & { readonly __brand: 'PostLaunchDate' }

@column(isoDateColumn<PostLaunchDate>('heroes', 'launched_on'))
declare launchedOn: PostLaunchDate
```

`isoDateColumn` checks that the value is a real `YYYY-MM-DD` date; it does not check that it is after
the host's launch date. The shown declaration asserts that host-specific cutoff; it does not enforce
it. Host code must enforce any stronger rule on values before writing and after reading them.
The ISO predicates narrow successful values to distinct validated string types. For `isOneOf`,
tuples of exact literals infer their listed values. The type predicate captures membership at creation.
Create a new type predicate after changing the allowlist. Dynamic arrays and tuples with widened,
pattern-typed, or union-typed elements preserve their element type in the false branch.
The same applies when the allowlist type is a union of different tuples.
Their validated value type is distinct, so validate a value before passing it to a column typed
from such an allowlist.

`isArrayOf` narrows successful values to a validated dense array. A rejected value may still be
an array, for example if it has holes. JSON column preparation accepts ordinary arrays and checks
their elements and density at runtime.

On the development branch (next release), the root and the type-only
`@kevinjohn/adonisjs-lucid-checked-columns/types` entry both expose
`JsonValidator`, `JsonColumnOptions`, `IsoColumnOptions`, `IsoDate` and `IsoTimestamp` with the
same type identities. The branded ISO types describe values narrowed by their respective predicates.

## Errors

Each package-created storage refusal throws a plain `Error` with the messages below; there are no HTTP
exceptions or stable storage error codes. Errors thrown by a supplied type predicate propagate unchanged.

- `Invalid persisted JSON in <table>.<column>`: a written value, its JSON encoding or a stored
  value fails the type predicate, or stored text is not JSON. The encoding is checked because JSON can
  change a value's shape: array holes and `NaN` become `null`, and `toJSON` replaces the value.
- `Cannot persist undefined JSON in <table>.<column>`: a written value passes the type predicate but has
  no JSON encoding (a function, for example).
- `Cannot encode JSON in <table>.<column>`: encoding a written value threw (a `BigInt` or a cycle,
  for example). The original error is the `cause`.
- `Invalid persisted date in <table>.<column>`
- `Invalid persisted timestamp in <table>.<column>`

## Limits

- The helpers validate; they never repair or convert. A `Date`, a Luxon `DateTime` or an instant
  with an offset is refused by the ISO helpers.
- Lucid runs `prepare` and `consume` for model reads and writes only. Query-builder writes bypass
  them.
- Lucid's dirty tracking can miss a changed top-level JSON object when that object has its own
  `isDirty: false` property. A model save can then skip the update before `prepare` runs. Avoid
  that property name for top-level object values when using model saves; arbitrary object keys
  require a fix in Lucid's dirty tracking.

## Development

```sh
pnpm install
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

`pnpm check:changed [--static] [base]` selects checks for files changed since `base` (default
`origin/main`). It formats changed files, runs lint and typecheck for relevant inputs, and runs
changed specs only when every changed path is a present spec; otherwise it selects the full test
suite. It builds when a changed path is outside `tests/`, `.github/`, root-level Markdown, and
Markdown in `user-stories/`. Formatter configuration,
`package.json`, and `pnpm-lock.yaml` changes select the full format check. `--static` skips the full
suite and build while still running specs changed in the diff.

The release gate installs its packed candidate in a scratch Lucid SQLite consumer and checks the
public declarations and a real model save and read. To run that check against a local candidate:

```sh
pnpm build
pnpm pack --pack-destination tmp/release
bash bin/release_consumer_smoke.sh tmp/release/*.tgz
```

## License

MIT
