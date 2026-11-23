import type { ColumnOptions } from '@adonisjs/lucid/types/model'
import type { JsonColumnOptions, JsonValidator } from './types.js'

/** Marks a column declared with `jsonColumn`, so the stored encoding can be read from the model. */
const JSON_COLUMN = Object.freeze({
  json: true,
  checkedColumns: '@kevinjohn/adonisjs-lucid-checked-columns/json',
})

declare const listedValue: unique symbol
type ListedValue<T> = T & { readonly [listedValue]: true }
type IsUnion<T, C = T> = T extends C ? ([C] extends [T] ? false : true) : never
type ListedMember<V extends readonly (string | number)[]> =
  Extract<V, (string | number)[]> extends never
    ? IsLiteralTuple<V> extends true
      ? V[number]
      : ListedValue<V[number]>
    : ListedValue<V[number]>
// Check union members together because an allowlist only contains the selected tuple.
type IsLiteralTuple<V extends readonly (string | number)[]> = [V] extends [readonly []]
  ? true
  : [V] extends [
        readonly [infer Head extends string | number, ...infer Tail extends (string | number)[]],
      ]
    ? IsUnion<Head> extends true
      ? false
      : // A pattern or broad key allows an empty record; a singleton key requires a property.
        {} extends Record<Head, never>
        ? false
        : IsLiteralTuple<Tail>
    : false

declare const denseArray: unique symbol
type DenseArray<T> = T[] & { readonly [denseArray]: true }
type JsonColumnInput<T> = T extends DenseArray<infer Element> ? JsonColumnInput<Element>[] : T

/** Accepts `true` and `false` only. */
export const isBoolean: JsonValidator<boolean> = (value): value is boolean =>
  typeof value === 'boolean'

/**
 * Accepts exactly the strings or numbers listed when the type predicate is created.
 * Readonly literal tuples narrow to their literal union. Mutable tuples and widened lists
 * narrow to a validated member without excluding their entire element type on rejection.
 */
export function isOneOf<const V extends readonly (string | number)[]>(
  values: V
): JsonValidator<ListedMember<V>> {
  const allowed = new Set<unknown>()
  for (let index = 0; index < values.length; index++) {
    if (Object.hasOwn(values, index)) allowed.add(values[index])
  }
  return ((value: unknown) => allowed.has(value)) as JsonValidator<ListedMember<V>>
}

/** Narrows to a dense array whose every element passes `acceptsValue`. Sparse arrays are rejected. */
export function isArrayOf<T>(acceptsValue: JsonValidator<T>): JsonValidator<DenseArray<T>> {
  return (value): value is DenseArray<T> => {
    if (!Array.isArray(value)) return false
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index) || !acceptsValue(value[index])) return false
    }
    return true
  }
}

/**
 * Column options that store one model property as JSON text and refuse an invalid value in both
 * directions. `null` passes through unchanged. `table` and `column` only name the column in errors.
 * A written value is validated before and after encoding. Under unchanged host validation rules,
 * the encoded value passes read-side validation. The `consume` hook still validates every read.
 * @throws Error `Invalid persisted JSON in <table>.<column>` when a written value or its JSON
 *   encoding fails `acceptsValue`, a stored value fails `acceptsValue`, or stored text is not JSON.
 * @throws Error `Cannot persist undefined JSON in <table>.<column>` when a written value passes
 *   `acceptsValue` but has no JSON encoding.
 * @throws Error `Cannot encode JSON in <table>.<column>` when encoding a written value throws (a
 *   BigInt or a cycle, for example); the original error is the `cause`.
 */
export function jsonColumn<T>(
  table: string,
  column: string,
  acceptsValue: JsonValidator<T>
): JsonColumnOptions<T, JsonColumnInput<T>> {
  const createInvalidJsonError = () => new Error(`Invalid persisted JSON in ${table}.${column}`)
  return {
    meta: JSON_COLUMN,
    prepare(value) {
      if (value === null) return null
      if (!acceptsValue(value)) throw createInvalidJsonError()
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
      if (!acceptsValue(JSON.parse(encoded))) throw createInvalidJsonError()
      return encoded
    },
    consume(value) {
      if (value === null) return null
      let parsed: unknown = value
      try {
        if (typeof value === 'string') parsed = JSON.parse(value)
      } catch {
        // No cause: the parser's message can quote the stored text, which may hold private data.
        throw createInvalidJsonError()
      }
      if (!acceptsValue(parsed)) throw createInvalidJsonError()
      return parsed
    },
  }
}

/** Whether a model column was declared with `jsonColumn`; pass `Model.$getColumn(name)`. */
export function isJsonColumn(options: Pick<ColumnOptions, 'meta'> | undefined): boolean {
  return options?.meta?.checkedColumns === JSON_COLUMN.checkedColumns
}
