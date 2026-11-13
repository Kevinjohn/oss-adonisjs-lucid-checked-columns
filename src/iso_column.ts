import type { ColumnOptions } from '@adonisjs/lucid/types/model'

/** Column options returned by the ISO helpers; pass them to Lucid's `@column` decorator. */
export type IsoColumnOptions<T extends string> = Pick<ColumnOptions, 'prepare' | 'consume'> & {
  prepare(value: T | null): T | null
  consume(value: unknown): T | null
}

/**
 * True only for a real calendar date written `YYYY-MM-DD`. Month lengths and leap years are
 * checked arithmetically, so the answer never depends on the host time zone.
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}

/**
 * True only for a string that round-trips exactly through `Date#toISOString()`: a UTC instant
 * with three millisecond digits and a trailing `Z`.
 */
export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) return false
  return new Date(milliseconds).toISOString() === value
}

function checkedColumn<T extends string>(
  table: string,
  column: string,
  kind: 'date' | 'timestamp',
  validate: (value: unknown) => boolean
): IsoColumnOptions<T> {
  const consume = (value: unknown) => {
    if (value === null) return null
    if (!validate(value)) throw new Error(`Invalid persisted ${kind} in ${table}.${column}`)
    return value as T
  }
  return { prepare: consume, consume }
}

/**
 * Column options that keep a canonical `YYYY-MM-DD` string unchanged in both directions and refuse
 * anything else. `null` passes through. `T` lets a host name its own string type for the property.
 * @throws Error `Invalid persisted date in <table>.<column>`.
 */
export function isoDateColumn<T extends string = string>(
  table: string,
  column: string
): IsoColumnOptions<T> {
  return checkedColumn<T>(table, column, 'date', isIsoDate)
}

/**
 * Column options that keep a canonical UTC instant with millisecond precision unchanged in both
 * directions and refuse anything else. `null` passes through.
 * @throws Error `Invalid persisted timestamp in <table>.<column>`.
 */
export function isoTimestampColumn<T extends string = string>(
  table: string,
  column: string
): IsoColumnOptions<T> {
  return checkedColumn<T>(table, column, 'timestamp', isIsoTimestamp)
}
