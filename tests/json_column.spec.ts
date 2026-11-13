import { test } from '@japa/runner'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { isArrayOf, isBoolean, isJsonColumn, isOneOf, jsonColumn } from '../index.js'

test.group('jsonColumn', () => {
  test('encodes a valid value on write and decodes it on read', ({ assert }) => {
    const options = jsonColumn('heroes', 'aliases', isArrayOf(isOneOf(['Batman', 'Robin'])))
    assert.equal(options.prepare(['Batman', 'Robin']), '["Batman","Robin"]')
    assert.deepEqual(options.consume('["Batman","Robin"]'), ['Batman', 'Robin'])
  })

  test('passes null through in both directions', ({ assert }) => {
    const options = jsonColumn('heroes', 'active', isBoolean)
    assert.isNull(options.prepare(null))
    assert.isNull(options.consume(null))
  })

  test('accepts a value the driver already decoded', ({ assert }) => {
    assert.isTrue(jsonColumn('heroes', 'active', isBoolean).consume(true))
  })

  test('refuses a written value the validator rejects', ({ assert }) => {
    const options = jsonColumn('heroes', 'active', isBoolean)
    assert.throws(() => options.prepare('yes' as never), 'Invalid persisted JSON in heroes.active')
  })

  test('refuses a stored value the validator rejects', ({ assert }) => {
    const options = jsonColumn('heroes', 'active', isBoolean)
    assert.throws(() => options.consume('"yes"'), 'Invalid persisted JSON in heroes.active')
    assert.throws(() => options.consume(1), 'Invalid persisted JSON in heroes.active')
  })

  test('refuses stored text that is not JSON', ({ assert }) => {
    const options = jsonColumn('heroes', 'active', isBoolean)
    assert.throws(() => options.consume('{tru'), 'Invalid persisted JSON in heroes.active')
  })

  test('refuses a written value that has no JSON encoding', ({ assert }) => {
    const anything = (value: unknown): value is unknown => value !== null
    const options = jsonColumn('heroes', 'origin', anything)
    assert.throws(
      () => options.prepare(() => 'Gotham'),
      'Cannot persist undefined JSON in heroes.origin'
    )
  })
})

test.group('validators', () => {
  test('isBoolean accepts only true and false', ({ assert }) => {
    assert.isTrue(isBoolean(true))
    assert.isTrue(isBoolean(false))
    assert.isFalse(isBoolean(1))
    assert.isFalse(isBoolean('true'))
    assert.isFalse(isBoolean(null))
  })

  test('isOneOf accepts only the listed values', ({ assert, expectTypeOf }) => {
    const isWeekStart = isOneOf([0, 1] as const)
    assert.isTrue(isWeekStart(0))
    assert.isTrue(isWeekStart(1))
    assert.isFalse(isWeekStart(2))
    assert.isFalse(isWeekStart('0'))
    const value: unknown = 1
    if (isWeekStart(value)) expectTypeOf(value).toEqualTypeOf<0 | 1>()
  })

  test('isArrayOf accepts only arrays whose every element is valid', ({ assert }) => {
    const isFlags = isArrayOf(isBoolean)
    assert.isTrue(isFlags([]))
    assert.isTrue(isFlags([true, false]))
    assert.isFalse(isFlags([true, 'false']))
    assert.isFalse(isFlags('[true]'))
  })
})

test.group('isJsonColumn', () => {
  test('recognises only columns declared with jsonColumn on a Lucid model', ({ assert }) => {
    class Hero extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column(jsonColumn('heroes', 'active', isBoolean))
      declare active: boolean

      @column({ meta: { json: true } })
      declare lookalike: string
    }
    Hero.boot()

    assert.isTrue(isJsonColumn(Hero.$getColumn('active')))
    assert.isFalse(isJsonColumn(Hero.$getColumn('id')))
    assert.isFalse(isJsonColumn(Hero.$getColumn('lookalike')))
    assert.isFalse(isJsonColumn(Hero.$getColumn('missing')))
  })
})
