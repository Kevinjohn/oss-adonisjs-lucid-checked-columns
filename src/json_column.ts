import type { ColumnOptions } from '@adonisjs/lucid/types/model'

/** Column options returned by `jsonColumn`; pass them to Lucid's `@column` decorator. */
export type JsonColumnOptions<T> = Pick<ColumnOptions, 'prepare' | 'consume' | 'meta'> & {
  prepare(value: T | null): string | null
  consume(value: unknown): T | null
}

/** Marks a column declared with `jsonColumn`, so the stored encoding can be read from the model. */
const JSON_COLUMN = Object.freeze({ json: true })

/** A type guard for the value one JSON column may hold. */
export type JsonValidator<T> = (value: unknown) => value is T

/** Accepts `true` and `false` only. */
export const isBoolean: JsonValidator<boolean> = (value): value is boolean =>
  typeof value === 'boolean'

/** Accepts exactly the listed strings or numbers. */
export function isOneOf<const T extends string | number>(values: readonly T[]): JsonValidator<T> {
  return (value): value is T => values.includes(value as T)
}

/** Accepts an array whose every element passes `validate`. */
export function isArrayOf<T>(validate: JsonValidator<T>): JsonValidator<T[]> {
  return (value): value is T[] => Array.isArray(value) && value.every(validate)
}

/**
 * Column options that store one model property as JSON text and refuse an invalid value in both
 * directions. `null` passes through unchanged. `table` and `column` only name the column in errors.
 * @throws Error `Invalid persisted JSON in <table>.<column>` when a written or stored value fails
 *   `validate`, or stored text is not JSON.
 * @throws Error `Cannot persist undefined JSON in <table>.<column>` when a written value passes
 *   `validate` but has no JSON encoding.
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
      const encoded = JSON.stringify(value) as string | undefined
      if (encoded === undefined) {
        throw new Error(`Cannot persist undefined JSON in ${table}.${column}`)
      }
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
  return options?.meta === JSON_COLUMN
}
