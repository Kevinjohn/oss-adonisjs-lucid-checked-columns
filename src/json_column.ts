import type { ColumnOptions } from '@adonisjs/lucid/types/model'
import {
  E_INVALID_JSON_COLUMN_VALUE,
  E_INVALID_PERSISTED_JSON,
  E_JSON_COLUMN_ENCODING,
  E_UNDEFINED_JSON_COLUMN_VALUE,
} from './errors.ts'
import type { JsonColumnOptions, JsonValidator } from './types.ts'

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

/**
 * Accepts `true` and `false` only.
 *
 * @example
 * ```ts
 * import { isBoolean } from '@kevinjohn/adonisjs-lucid-checked-columns'
 *
 * isBoolean(false) // true
 * ```
 */
export const isBoolean: JsonValidator<boolean> = (value): value is boolean =>
  typeof value === 'boolean'

/**
 * Accepts exactly the strings or numbers listed when the type predicate is created.
 * Readonly literal tuples narrow to their literal union. Mutable tuples and widened lists
 * narrow to a validated member without excluding their entire element type on rejection.
 *
 * @example
 * ```ts
 * import { isOneOf } from '@kevinjohn/adonisjs-lucid-checked-columns'
 *
 * const isReadingState = isOneOf(['queued', 'finished'] as const)
 * isReadingState('queued') // true
 * ```
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

/**
 * Narrows to a dense array whose every element passes `acceptsValue`. Sparse arrays are rejected.
 *
 * @example
 * ```ts
 * import { isArrayOf, isBoolean } from '@kevinjohn/adonisjs-lucid-checked-columns'
 *
 * const isFlags = isArrayOf(isBoolean)
 * isFlags([true, false]) // true
 * ```
 */
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
 *
 * @throws errors.E_INVALID_JSON_COLUMN_VALUE when a write or its encoding fails `acceptsValue`.
 * @throws errors.E_INVALID_PERSISTED_JSON when a stored value is malformed or fails `acceptsValue`.
 * @throws errors.E_UNDEFINED_JSON_COLUMN_VALUE when an accepted write has no JSON encoding.
 * @throws errors.E_JSON_COLUMN_ENCODING when encoding a write throws. The original error is the
 *   `cause`.
 *
 * @example
 * ```ts
 * import { isArrayOf, isOneOf, jsonColumn } from '@kevinjohn/adonisjs-lucid-checked-columns'
 * import { BaseModel, column } from '@adonisjs/lucid/orm'
 *
 * class ReadingItem extends BaseModel {
 *   @column(jsonColumn('reading_items', 'labels', isArrayOf(isOneOf(['fiction', 'history']))))
 *   declare labels: ('fiction' | 'history')[] | null
 * }
 * ```
 */
export function jsonColumn<T>(
  table: string,
  column: string,
  acceptsValue: JsonValidator<T>
): JsonColumnOptions<T, JsonColumnInput<T>> {
  return {
    meta: JSON_COLUMN,
    prepare(value) {
      if (value === null) return null
      if (!acceptsValue(value)) throw new E_INVALID_JSON_COLUMN_VALUE(table, column)
      // The lib types promise a string, but functions and undefined serialise to undefined, and an
      // annotated declaration would narrow straight back to string on assignment.
      let encoded: string | undefined
      try {
        encoded = JSON.stringify(value) as string | undefined
      } catch (cause) {
        throw new E_JSON_COLUMN_ENCODING(table, column, { cause })
      }
      if (encoded === undefined) {
        throw new E_UNDEFINED_JSON_COLUMN_VALUE(table, column)
      }
      // Encoding can change the shape (holes and NaN become null, toJSON replaces the value): refuse
      // an encoding the read side would reject instead of storing it.
      if (!acceptsValue(JSON.parse(encoded))) throw new E_INVALID_JSON_COLUMN_VALUE(table, column)
      return encoded
    },
    consume(value) {
      if (value === null) return null
      let parsed: unknown = value
      try {
        if (typeof value === 'string') parsed = JSON.parse(value)
      } catch {
        // No cause: the parser's message can quote the stored text, which may hold private data.
        throw new E_INVALID_PERSISTED_JSON(table, column)
      }
      if (!acceptsValue(parsed)) throw new E_INVALID_PERSISTED_JSON(table, column)
      return parsed
    },
  }
}

/**
 * Whether a model column was declared with `jsonColumn`; pass `Model.$getColumn(name)`.
 *
 * @example
 * ```ts
 * import { isBoolean, isJsonColumn, jsonColumn } from '@kevinjohn/adonisjs-lucid-checked-columns'
 * import { BaseModel, column } from '@adonisjs/lucid/orm'
 *
 * class ReadingItem extends BaseModel {
 *   @column(jsonColumn('reading_items', 'finished', isBoolean))
 *   declare finished: boolean | null
 * }
 *
 * ReadingItem.boot()
 * isJsonColumn(ReadingItem.$getColumn('finished')) // true
 * ```
 */
export function isJsonColumn(options: Pick<ColumnOptions, 'meta'> | undefined): boolean {
  return options?.meta?.checkedColumns === JSON_COLUMN.checkedColumns
}
