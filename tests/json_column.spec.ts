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

  test('refuses a written value whose encoding the validator rejects', ({ assert }) => {
    const flags = jsonColumn('heroes', 'flags', isArrayOf(isBoolean))
    // A hole encodes as null.
    assert.throws(() => flags.prepare(Array(1)), 'Invalid persisted JSON in heroes.flags')

    const limits = jsonColumn('heroes', 'limits', isArrayOf(isOneOf([Number.NaN, Infinity])))
    // isOneOf matches NaN (Array.includes uses SameValueZero); both encode as null.
    assert.throws(
      () => limits.prepare([Number.NaN, Infinity]),
      'Invalid persisted JSON in heroes.limits'
    )

    const isAlias = (value: unknown): value is { alias: string } =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { alias?: unknown }).alias === 'string'
    const alias = jsonColumn('heroes', 'alias', isAlias)
    const disguised = { alias: 'Batman', toJSON: () => 'Bruce Wayne' }
    assert.throws(() => alias.prepare(disguised), 'Invalid persisted JSON in heroes.alias')
  })

  test('wraps an encoding error in a column error with the original as its cause', ({ assert }) => {
    const anything = (value: unknown): value is unknown => value !== null
    const options = jsonColumn('heroes', 'origin', anything)
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    for (const value of [1n, cycle]) {
      try {
        options.prepare(value)
        assert.fail('prepare should throw')
      } catch (error) {
        assert.equal((error as Error).message, 'Cannot encode JSON in heroes.origin')
        assert.instanceOf((error as Error).cause, TypeError)
      }
    }
  })

  test('whatever prepare returns, consume accepts', ({ assert }) => {
    const options = jsonColumn('heroes', 'aliases', isArrayOf(isOneOf(['Batman', 'Robin'])))
    const encoded = options.prepare(['Robin', 'Batman'])
    assert.deepEqual(options.consume(encoded), ['Robin', 'Batman'])
  })
})

test.group('jsonColumn on a Lucid model', () => {
  // An in-memory adapter instead of a database driver: Lucid's own save and hydration paths run
  // the column hooks, which is the boundary under test. Driver behaviour is not covered.
  function heroModel() {
    const rows = new Map<number, Record<string, unknown>>()
    class Hero extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column(jsonColumn('heroes', 'aliases', isArrayOf(isOneOf(['Batman', 'Robin']))))
      declare aliases: ('Batman' | 'Robin')[]
    }
    Hero.boot()
    Hero.useAdapter({
      async insert(instance, attributes) {
        const id = rows.size + 1
        rows.set(id, { ...attributes, id })
        instance.$consumeAdapterResult({ id })
      },
    } as Parameters<typeof Hero.useAdapter>[0])
    return { Hero, rows }
  }

  test('save stores the encoding and hydration decodes it', async ({ assert }) => {
    const { Hero, rows } = heroModel()
    const hero = new Hero()
    hero.aliases = ['Batman', 'Robin']
    await hero.save()

    assert.deepEqual(rows.get(hero.id), { id: 1, aliases: '["Batman","Robin"]' })
    const fetched = Hero.$createFromAdapterResult(rows.get(hero.id))!
    assert.deepEqual(fetched.aliases, ['Batman', 'Robin'])
  })

  test('save refuses an invalid value and hydration refuses a malformed row', async ({
    assert,
  }) => {
    const { Hero, rows } = heroModel()
    const hero = new Hero()
    hero.aliases = ['Joker'] as never
    await assert.rejects(() => hero.save(), 'Invalid persisted JSON in heroes.aliases')
    assert.equal(rows.size, 0)

    for (const aliases of ['["Batman"', '["Joker"]']) {
      assert.throws(
        () => Hero.$createFromAdapterResult({ id: 2, aliases }),
        'Invalid persisted JSON in heroes.aliases'
      )
    }
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
