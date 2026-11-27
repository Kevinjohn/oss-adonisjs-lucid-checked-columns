import assert from 'node:assert/strict'
import { AppFactory } from '@adonisjs/core/factories/app'
import { Exception } from '@adonisjs/core/exceptions'
import { Emitter } from '@adonisjs/core/events'
import { LoggerFactory } from '@adonisjs/core/factories/logger'
import { Database } from '@adonisjs/lucid/database'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import {
  errors,
  isArrayOf,
  isBoolean,
  isIsoDate,
  isIsoTimestamp,
  isJsonColumn,
  isOneOf,
  isoDateColumn,
  isoTimestampColumn,
  jsonColumn,
  type IsoColumnOptions,
  type IsoDate,
  type IsoTimestamp,
  type JsonColumnOptions,
  type JsonValidator as RootValidator,
} from '@kevinjohn/adonisjs-lucid-checked-columns'
import type {
  IsoColumnOptions as SubpathIsoOptions,
  IsoDate as SubpathDate,
  IsoTimestamp as SubpathTimestamp,
  JsonColumnOptions as SubpathJsonOptions,
} from '@kevinjohn/adonisjs-lucid-checked-columns/types'
// The inline form keeps a runtime import under verbatimModuleSyntax, so the subpath must load.
import { type JsonValidator } from '@kevinjohn/adonisjs-lucid-checked-columns/types'

const app = new AppFactory().create(new URL('../', import.meta.url), () => {})
const db = new Database(
  {
    connection: 'sqlite',
    connections: {
      sqlite: { client: 'better-sqlite3', connection: { filename: ':memory:' } },
    },
  },
  new LoggerFactory().create(),
  new Emitter(app)
)
BaseModel.useAdapter(db.modelAdapter())
const acceptsLabel: JsonValidator<'verified'> = isOneOf(['verified'])

class ReleaseRecord extends BaseModel {
  static table = 'release_records'

  @column({ isPrimary: true })
  declare id: number

  @column(jsonColumn('release_records', 'labels', isArrayOf(acceptsLabel)))
  declare labels: 'verified'[] | null

  @column(isoDateColumn('release_records', 'date'))
  declare date: string

  @column(isoTimestampColumn('release_records', 'timestamp'))
  declare timestamp: string
}

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
// The root and /types entries must expose the same five type identities.
export const sameTypeIdentities: [
  Equal<IsoDate, SubpathDate>,
  Equal<IsoTimestamp, SubpathTimestamp>,
  Equal<IsoColumnOptions<IsoDate>, SubpathIsoOptions<SubpathDate>>,
  Equal<JsonColumnOptions<string[]>, SubpathJsonOptions<string[]>>,
  Equal<RootValidator<IsoDate>, JsonValidator<SubpathDate>>,
] = [true, true, true, true, true]

// Verify that unresolved declaration re-exports cannot silently pass this consumer's typecheck.
export function typecheckColumnHooks() {
  // @ts-expect-error JSON preparation requires boolean elements.
  jsonColumn('release_records', 'labels', isArrayOf(isBoolean)).prepare(['true'])
  // @ts-expect-error ISO date preparation requires a date string.
  isoDateColumn('release_records', 'date').prepare(1)
}

try {
  await db.connection().schema.createTable(ReleaseRecord.table, (table) => {
    table.increments('id')
    table.text('labels')
    table.text('date').notNullable()
    table.text('timestamp').notNullable()
  })

  const date = '2026-11-19'
  const timestamp = '2026-11-19T12:00:00.000Z'
  assert(isIsoDate(date))
  assert(isIsoTimestamp(timestamp))
  const rootDate: IsoDate = date
  const rootTimestamp: IsoTimestamp = timestamp
  const subpathDate: SubpathDate = rootDate
  const subpathTimestamp: SubpathTimestamp = rootTimestamp
  const saved = await ReleaseRecord.create({
    labels: ['verified'],
    date: subpathDate,
    timestamp: subpathTimestamp,
  })
  const stored = await db.from(ReleaseRecord.table).where('id', saved.id).firstOrFail()
  assert.deepEqual(stored, { id: saved.id, labels: '["verified"]', date, timestamp })

  const loaded = await ReleaseRecord.findOrFail(saved.id)
  assert(isJsonColumn(ReleaseRecord.$getColumn('labels')))
  assert.deepEqual(loaded.labels, ['verified'])
  assert.equal(loaded.date, date)
  assert.equal(loaded.timestamp, timestamp)
  loaded.labels = null
  await loaded.save()
  const reloaded = await ReleaseRecord.findOrFail(saved.id)
  const storedNull = await db.from(ReleaseRecord.table).where('id', saved.id).firstOrFail()
  assert.equal(reloaded.labels, null)
  assert.equal(storedNull.labels, null)

  await assert.rejects(
    ReleaseRecord.create({ labels: ['verified'], date: 'invalid', timestamp }),
    (error: unknown) => {
      assert(error instanceof errors.E_INVALID_ISO_COLUMN_VALUE)
      assert.equal(error.code, 'E_INVALID_ISO_COLUMN_VALUE')
      assert.equal(error.kind, 'date')
      assert.equal(error.message, 'Invalid persisted date in release_records.date')
      return true
    }
  )
  for (const labels of ['{"private-sample"', '{"private-sample":true}']) {
    await db.from(ReleaseRecord.table).where('id', saved.id).update({ labels })
    await assert.rejects(ReleaseRecord.findOrFail(saved.id), (error: unknown) => {
      assert(error instanceof errors.E_INVALID_PERSISTED_JSON)
      assert(error instanceof Exception)
      assert.equal(error.code, 'E_INVALID_PERSISTED_JSON')
      assert.equal(error.status, 500)
      assert.equal(error.table, ReleaseRecord.table)
      assert.equal(error.column, 'labels')
      assert.equal(error.message, 'Invalid persisted JSON in release_records.labels')
      assert.equal(error.cause, undefined)
      assert.doesNotMatch(String(error.stack), /private-sample/)
      return true
    })
  }
  console.log('Packed checked columns passed the Lucid SQLite round trip.')
} finally {
  await db.manager.closeAll()
}
