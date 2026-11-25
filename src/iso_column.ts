import { E_INVALID_ISO_COLUMN_VALUE } from './errors.ts'
import type { IsoColumnOptions, IsoDate, IsoTimestamp } from './types.ts'

/**
 * True only for a real calendar date written `YYYY-MM-DD`. Month lengths and leap years are
 * checked arithmetically, so the answer never depends on the host time zone.
 *
 * @example
 * ```ts
 * import { isIsoDate } from '@kevinjohn/adonisjs-lucid-checked-columns'
 *
 * isIsoDate('2028-02-29') // true
 * ```
 */
export function isIsoDate(value: unknown): value is IsoDate {
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
 *
 * @example
 * ```ts
 * import { isIsoTimestamp } from '@kevinjohn/adonisjs-lucid-checked-columns'
 *
 * isIsoTimestamp('2028-02-29T10:00:00.000Z') // true
 * ```
 */
export function isIsoTimestamp(value: unknown): value is IsoTimestamp {
  if (typeof value !== 'string') return false
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) return false
  return new Date(milliseconds).toISOString() === value
}

interface IsoColumnInput {
  table: string
  column: string
  kind: 'date' | 'timestamp'
  acceptsValue: (value: unknown) => boolean
}

function createIsoColumnOptions<T extends string>({
  table,
  column,
  kind,
  acceptsValue,
}: IsoColumnInput): IsoColumnOptions<T> {
  const consume = (value: unknown) => {
    if (value === null) return null
    if (!acceptsValue(value)) throw new E_INVALID_ISO_COLUMN_VALUE(table, column, kind)
    return value as T
  }
  return { prepare: consume, consume }
}

/**
 * Column options that keep a canonical `YYYY-MM-DD` string unchanged in both directions and refuse
 * anything else. `null` passes through. `T` lets a host name its own string type for the property.
 * @throws errors.E_INVALID_ISO_COLUMN_VALUE when the value is outside the canonical format.
 *
 * @example
 * ```ts
 * import { isoDateColumn } from '@kevinjohn/adonisjs-lucid-checked-columns'
 * import { BaseModel, column } from '@adonisjs/lucid/orm'
 *
 * class ReadingItem extends BaseModel {
 *   @column(isoDateColumn('reading_items', 'starts_on'))
 *   declare startsOn: string | null
 * }
 * ```
 */
export function isoDateColumn<T extends string = string>(
  table: string,
  column: string
): IsoColumnOptions<T> {
  return createIsoColumnOptions<T>({ table, column, kind: 'date', acceptsValue: isIsoDate })
}

/**
 * Column options that keep a canonical UTC instant with millisecond precision unchanged in both
 * directions and refuse anything else. `null` passes through.
 * @throws errors.E_INVALID_ISO_COLUMN_VALUE when the value is outside the canonical format.
 *
 * @example
 * ```ts
 * import { isoTimestampColumn } from '@kevinjohn/adonisjs-lucid-checked-columns'
 * import { BaseModel, column } from '@adonisjs/lucid/orm'
 *
 * class ReadingItem extends BaseModel {
 *   @column(isoTimestampColumn('reading_items', 'finished_at'))
 *   declare finishedAt: string | null
 * }
 * ```
 */
export function isoTimestampColumn<T extends string = string>(
  table: string,
  column: string
): IsoColumnOptions<T> {
  return createIsoColumnOptions<T>({
    table,
    column,
    kind: 'timestamp',
    acceptsValue: isIsoTimestamp,
  })
}
