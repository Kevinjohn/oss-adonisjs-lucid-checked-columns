import assert from 'node:assert/strict'
import { AppFactory } from '@adonisjs/core/factories/app'
import { Emitter } from '@adonisjs/core/events'
import { LoggerFactory } from '@adonisjs/core/factories/logger'
import { Database } from '@adonisjs/lucid/database'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import {
  isArrayOf,
  isBoolean,
  isIsoDate,
  isIsoTimestamp,
  isJsonColumn,
  isOneOf,
  isoDateColumn,
  isoTimestampColumn,
  jsonColumn,
  type IsoDate,
  type IsoTimestamp,
} from '@kevinjohn/adonisjs-lucid-checked-columns'
import type {
  IsoDate as SubpathDate,
  IsoTimestamp as SubpathTimestamp,
} from '@kevinjohn/adonisjs-lucid-checked-columns/types'

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

class ReleaseRecord extends BaseModel {
  static table = 'release_records'

  @column({ isPrimary: true })
  declare id: number

  @column(jsonColumn('release_records', 'labels', isArrayOf(isOneOf(['verified']))))
  declare labels: 'verified'[]

  @column(isoDateColumn('release_records', 'date'))
  declare date: string

  @column(isoTimestampColumn('release_records', 'timestamp'))
  declare timestamp: string
}

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
    table.text('labels').notNullable()
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
  await assert.rejects(
    ReleaseRecord.create({ labels: ['verified'], date: 'invalid', timestamp }),
    /Invalid persisted date in release_records.date/
  )
  await db.from(ReleaseRecord.table).where('id', saved.id).update({ labels: 'invalid JSON' })
  await assert.rejects(
    ReleaseRecord.findOrFail(saved.id),
    /Invalid persisted JSON in release_records.labels/
  )
  console.log('Packed checked columns passed the Lucid SQLite round trip.')
} finally {
  await db.manager.closeAll()
}
