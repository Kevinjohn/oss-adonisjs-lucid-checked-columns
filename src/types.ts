import type { ColumnOptions, LucidRow } from '@adonisjs/lucid/types/model'

/** Column options returned by `jsonColumn`; pass them to Lucid's `@column` decorator. */
export type JsonColumnOptions<T, Input = T> = Pick<ColumnOptions, 'meta'> & {
  prepare(value: Input | null, attribute?: string, model?: LucidRow): string | null
  consume(value: unknown, attribute?: string, model?: LucidRow): T | null
}

/** A TypeScript type predicate narrowing unknown values to the type one JSON column may hold. */
export type JsonValidator<T> = (value: unknown) => value is T

/** Column options returned by the ISO helpers; pass them to Lucid's `@column` decorator. */
export type IsoColumnOptions<T extends string> = {
  prepare(value: T | null, attribute?: string, model?: LucidRow): T | null
  consume(value: unknown, attribute?: string, model?: LucidRow): T | null
}

declare const isoDateBrand: unique symbol
declare const isoTimestampBrand: unique symbol
/** A calendar date narrowed by `isIsoDate`, in canonical YYYY-MM-DD form. */
export type IsoDate = string & { readonly [isoDateBrand]: true }
/** A UTC instant narrowed by `isIsoTimestamp`, exactly as Date#toISOString returns it. */
export type IsoTimestamp = string & { readonly [isoTimestampBrand]: true }
