# @kevinjohn/adonisjs-lucid-checked-columns

Checked JSON, ISO date and ISO timestamp columns for AdonisJS Lucid models. Each helper returns
`prepare`/`consume` options for Lucid's `@column` decorator that refuse an invalid value in both
directions, so a corrupt row fails loudly when it is read instead of reaching the application.

Requires Node 24 or later and `@adonisjs/lucid` 22.

## Install

Releases are GitHub release tarballs; the package is not on the npm registry.

```sh
pnpm add https://github.com/Kevinjohn/oss-adonisjs-lucid-checked-columns/releases/download/v0.1.0/kevinjohn-adonisjs-lucid-checked-columns-0.1.0.tgz
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

| Export                                      | Behaviour                                                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `jsonColumn(table, column, validate)`       | Writes `JSON.stringify(value)`; reads with `JSON.parse` when the driver returns text. `null` passes through. The value must pass `validate` both ways. |
| `isBoolean`                                 | Validator: `true` or `false`.                                                                                                                          |
| `isOneOf(values)`                           | Validator: exactly one of the listed strings or numbers.                                                                                               |
| `isArrayOf(validate)`                       | Validator: an array whose every element passes `validate`.                                                                                             |
| `isJsonColumn(options)`                     | Whether a column was declared with `jsonColumn`. Pass `Model.$getColumn(name)`; use it to find the JSON columns when writing rows outside the model.   |
| `isoDateColumn(table, column)`              | Keeps a real calendar date written `YYYY-MM-DD` unchanged; refuses anything else. `null` passes through.                                               |
| `isoTimestampColumn(table, column)`         | Keeps a UTC instant exactly as `Date#toISOString()` writes it (three millisecond digits, trailing `Z`) unchanged; refuses anything else.               |
| `isIsoDate(value)`, `isIsoTimestamp(value)` | The predicates the two ISO helpers use.                                                                                                                |

Any `(value: unknown) => value is T` function is a validator, so a host can supply its own.
`isoDateColumn<T>` and `isoTimestampColumn<T>` accept a host string type for the property.

## Errors

Each refusal throws a plain `Error`:

- `Invalid persisted JSON in <table>.<column>`: a written or stored value fails the validator, or
  stored text is not JSON.
- `Cannot persist undefined JSON in <table>.<column>`: a written value passes the validator but has
  no JSON encoding (a function, for example).
- `Invalid persisted date in <table>.<column>`
- `Invalid persisted timestamp in <table>.<column>`

## Limits

- The helpers validate; they never repair or convert. A `Date`, a Luxon `DateTime` or an instant
  with an offset is refused by the ISO helpers.
- Lucid runs `prepare` and `consume` for model reads and writes only. Query-builder writes bypass
  them.

## Development

```sh
pnpm install
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT
