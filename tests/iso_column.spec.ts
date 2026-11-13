import { test } from '@japa/runner'
import { isIsoDate, isIsoTimestamp, isoDateColumn, isoTimestampColumn } from '../index.js'

test.group('isoDateColumn', () => {
  test('keeps a canonical date unchanged in both directions', ({ assert }) => {
    const options = isoDateColumn('missions', 'starts_on')
    assert.equal(options.prepare('2028-02-29'), '2028-02-29')
    assert.equal(options.consume('2028-02-29'), '2028-02-29')
  })

  test('passes null through in both directions', ({ assert }) => {
    const options = isoDateColumn('missions', 'starts_on')
    assert.isNull(options.prepare(null))
    assert.isNull(options.consume(null))
  })

  test('refuses anything else in both directions', ({ assert }) => {
    const options = isoDateColumn('missions', 'starts_on')
    for (const value of ['2027-02-29', '2026-13-01', '2026-1-01', '2026-01-01T00:00:00.000Z', 7]) {
      assert.throws(() => options.consume(value), 'Invalid persisted date in missions.starts_on')
      assert.throws(
        () => options.prepare(value as never),
        'Invalid persisted date in missions.starts_on'
      )
    }
  })

  test('types the property with the host string type', ({ expectTypeOf }) => {
    type MissionDate = string & { readonly brand: 'MissionDate' }
    const options = isoDateColumn<MissionDate>('missions', 'starts_on')
    expectTypeOf(options.consume('2026-01-01')).toEqualTypeOf<MissionDate | null>()
    expectTypeOf(isoDateColumn('missions', 'ends_on').consume('2026-01-01')).toEqualTypeOf<
      string | null
    >()
  })
})

test.group('isoTimestampColumn', () => {
  test('keeps a canonical UTC instant unchanged in both directions', ({ assert }) => {
    const options = isoTimestampColumn('missions', 'created_at')
    assert.equal(options.prepare('2026-07-18T10:00:00.000Z'), '2026-07-18T10:00:00.000Z')
    assert.equal(options.consume('2026-07-18T10:00:00.000Z'), '2026-07-18T10:00:00.000Z')
    assert.isNull(options.consume(null))
  })

  test('refuses anything else in both directions', ({ assert }) => {
    const options = isoTimestampColumn('missions', 'created_at')
    for (const value of [
      '2026-07-18T10:00:00Z',
      '2026-07-18T11:00:00.000+01:00',
      '2026-07-18 10:00:00',
      '2026-07-18',
      'soon',
      1_784_368_800_000,
    ]) {
      assert.throws(
        () => options.consume(value),
        'Invalid persisted timestamp in missions.created_at'
      )
      assert.throws(
        () => options.prepare(value as never),
        'Invalid persisted timestamp in missions.created_at'
      )
    }
  })
})

test.group('ISO predicates', () => {
  test('isIsoDate accepts only real calendar dates', ({ assert }) => {
    for (const value of ['2026-01-31', '2028-02-29', '2000-02-29', '0001-01-01']) {
      assert.isTrue(isIsoDate(value), value)
    }
    for (const value of [
      '2026-02-29',
      '1900-02-29',
      '2026-04-31',
      '2026-00-10',
      '2026-13-10',
      '2026-01-00',
      '0000-01-01',
      '26-01-01',
      ' 2026-01-01',
      null,
      20260101,
    ]) {
      assert.isFalse(isIsoDate(value), String(value))
    }
  })

  test('isIsoTimestamp accepts only strings Date#toISOString() produces', ({ assert }) => {
    assert.isTrue(isIsoTimestamp('2026-07-18T10:00:00.000Z'))
    for (const value of ['2026-07-18T10:00:00.00Z', '2026-02-30T10:00:00.000Z', '', null, 0]) {
      assert.isFalse(isIsoTimestamp(value), String(value))
    }
  })
})
