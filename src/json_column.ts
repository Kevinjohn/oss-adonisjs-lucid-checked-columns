import type { ColumnOptions } from '@adonisjs/lucid/types/model'

/** Column options returned by `jsonColumn`; pass them to Lucid's `@column` decorator. */
export type JsonColumnOptions<T> = Pick<ColumnOptions, 'prepare' | 'consume' | 'meta'> & {
  prepare(value: T | null): string | null
  consume(value: unknown): T | null
}

/** Marks a column declared with `jsonColumn`, so the stored encoding can be read from the model. */
const JSON_COLUMN = Object.freeze({
  json: true,
  checkedColumns: '@kevinjohn/adonisjs-lucid-checked-columns/json',
})

declare const listedValue: unique symbol
type ListedValue<T> = T & { readonly [listedValue]: true }
type IsUnion<T, C = T> = T extends C ? ([C] extends [T] ? false : true) : never
type IsLiteralTuple<V extends readonly (string | number)[]> = number extends V['length']
  ? false
  : V extends readonly [
        infer Head extends string | number,
        ...infer Tail extends (string | number)[],
      ]
    ? string extends Head
      ? false
      : number extends Head
        ? false
        : IsUnion<Head> extends true
          ? false
          : IsLiteralTuple<Tail>
    : true

/** A type guard for the value one JSON column may hold. */
export type JsonValidator<T> = (value: unknown) => value is T

/** Accepts `true` and `false` only. */
export const isBoolean: JsonValidator<boolean> = (value): value is boolean =>
  typeof value === 'boolean'

/** Accepts exactly the listed strings or numbers. */
export function isOneOf<const V extends readonly (string | number)[]>(
  values: V
): JsonValidator<IsLiteralTuple<V> extends true ? V[number] : ListedValue<V[number]>> {
  return ((value: unknown) => {
    for (let index = 0; index < values.length; index++) {
      if (!Object.hasOwn(values, index)) continue
      const entry = values[index]
      if (entry === value || (Number.isNaN(entry) && Number.isNaN(value))) return true
    }
    return false
  }) as JsonValidator<IsLiteralTuple<V> extends true ? V[number] : ListedValue<V[number]>>
}

/** Accepts an array whose every element passes `validate`. */
export function isArrayOf<T>(validate: JsonValidator<T>): JsonValidator<T[]> {
  return (value): value is T[] => {
    if (!Array.isArray(value)) return false
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index) || !validate(value[index])) return false
    }
    return true
  }
}

/**
 * Column options that store one model property as JSON text and refuse an invalid value in both
 * directions. `null` passes through unchanged. `table` and `column` only name the column in errors.
 * A written value is validated before and after encoding, so whatever `prepare` returns, `consume`
 * accepts.
 * @throws Error `Invalid persisted JSON in <table>.<column>` when a written value or its JSON
 *   encoding fails `validate`, a stored value fails `validate`, or stored text is not JSON.
 * @throws Error `Cannot persist undefined JSON in <table>.<column>` when a written value passes
 *   `validate` but has no JSON encoding.
 * @throws Error `Cannot encode JSON in <table>.<column>` when encoding a written value throws (a
 *   BigInt or a cycle, for example); the original error is the `cause`.
 */
export function jsonColumn<T>(
  table: string,
  column: string,
  validate: JsonValidator<T>
): JsonColumnOptions<T> {
  const invalid = () => new Error(`Invalid persisted JSON in ${table}.${column}`)
  return {
    meta: JSON_COLUMN,
    prepare(value) {
      if (value === null) return null
      if (!validate(value)) throw invalid()
      // The lib types promise a string, but functions and undefined serialise to undefined, and an
      // annotated declaration would narrow straight back to string on assignment.
      let encoded: string | undefined
      try {
        encoded = JSON.stringify(value) as string | undefined
      } catch (cause) {
        throw new Error(`Cannot encode JSON in ${table}.${column}`, { cause })
      }
      if (encoded === undefined) {
        throw new Error(`Cannot persist undefined JSON in ${table}.${column}`)
      }
      // Encoding can change the shape (holes and NaN become null, toJSON replaces the value): refuse
      // an encoding the read side would reject instead of storing it.
      if (!validate(JSON.parse(encoded))) throw invalid()
      return encoded
    },
    consume(value) {
      if (value === null) return null
      let parsed: unknown = value
      try {
        if (typeof value === 'string') parsed = JSON.parse(value)
      } catch {
        throw invalid()
      }
      if (!validate(parsed)) throw invalid()
      return parsed
    },
  }
}

/** Whether a model column was declared with `jsonColumn`; pass `Model.$getColumn(name)`. */
export function isJsonColumn(options: Pick<ColumnOptions, 'meta'> | undefined): boolean {
  return options?.meta?.checkedColumns === JSON_COLUMN.checkedColumns
}
