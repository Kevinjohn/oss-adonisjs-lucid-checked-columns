import { test } from '@japa/runner'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { LucidRow } from '@adonisjs/lucid/types/model'
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

  test('refuses a written value the type predicate rejects', ({ assert }) => {
    const options = jsonColumn('heroes', 'active', isBoolean)
    assert.throws(() => options.prepare('yes' as never), 'Invalid persisted JSON in heroes.active')
  })

  test('refuses a stored value the type predicate rejects', ({ assert }) => {
    const options = jsonColumn('heroes', 'active', isBoolean)
    assert.throws(() => options.consume('"yes"'), 'Invalid persisted JSON in heroes.active')
    assert.throws(() => options.consume(1), 'Invalid persisted JSON in heroes.active')
  })

  test('refuses stored text that is not JSON', ({ assert }) => {
    const options = jsonColumn('heroes', 'active', isBoolean)
    assert.throws(() => options.consume('{tru'), 'Invalid persisted JSON in heroes.active')
  })

  test('refuses a written value that has no JSON encoding', ({ assert }) => {
    const acceptsAnyValue = (value: unknown): value is unknown => value !== null
    const options = jsonColumn('heroes', 'origin', acceptsAnyValue)
    assert.throws(
      () => options.prepare(() => 'Gotham'),
      'Cannot persist undefined JSON in heroes.origin'
    )
  })

  test('refuses a written value whose encoding the type predicate rejects', ({ assert }) => {
    const flags = jsonColumn('heroes', 'flags', isArrayOf(isBoolean))
    // A hole encodes as null.
    assert.throws(() => flags.prepare(Array(1)), 'Invalid persisted JSON in heroes.flags')

    const limits = jsonColumn('heroes', 'limits', isArrayOf(isOneOf([Number.NaN, Infinity])))
    // isOneOf matches NaN (Array.includes uses SameValueZero); both encode as null.
    assert.throws(
      () => limits.prepare([Number.NaN, Infinity] as never),
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
    const acceptsAnyValue = (value: unknown): value is unknown => value !== null
    const options = jsonColumn('heroes', 'origin', acceptsAnyValue)
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

    const sentinel = new Error('toJSON failed')
    try {
      options.prepare({
        toJSON: () => {
          throw sentinel
        },
      })
      assert.fail('prepare should throw')
    } catch (error) {
      assert.equal((error as Error).message, 'Cannot encode JSON in heroes.origin')
      assert.strictEqual((error as Error).cause, sentinel)
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
  function createHeroModel() {
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
    const { Hero, rows } = createHeroModel()
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
    const { Hero, rows } = createHeroModel()
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
  test('Lucid skips a changed object when its own isDirty is false', async ({ assert }) => {
    const rows = new Map<number, Record<string, unknown>>()
    class RecordModel extends BaseModel {
      @column({ isPrimary: true })
      declare id: number

      @column(
        jsonColumn(
          'records',
          'payload',
          (value): value is { isDirty: boolean; name: string } =>
            typeof value === 'object' &&
            value !== null &&
            typeof (value as { isDirty?: unknown }).isDirty === 'boolean' &&
            typeof (value as { name?: unknown }).name === 'string'
        )
      )
      declare payload: { isDirty: boolean; name: string }
    }
    RecordModel.boot()
    let updates = 0
    RecordModel.useAdapter({
      async insert(instance, attributes) {
        rows.set(1, { ...attributes, id: 1 })
        instance.$consumeAdapterResult({ id: 1 })
      },
      async update(_instance, attributes) {
        updates++
        rows.set(1, { ...rows.get(1), ...attributes })
      },
    } as Parameters<typeof RecordModel.useAdapter>[0])
    const record = new RecordModel()
    record.payload = { isDirty: true, name: 'before' }
    await record.save()
    const fetched = RecordModel.$createFromAdapterResult(rows.get(1))!
    fetched.payload = { isDirty: false, name: 'after' }
    await fetched.save()
    assert.equal(updates, 0)
    assert.deepEqual(rows.get(1), { id: 1, payload: '{"isDirty":true,"name":"before"}' })
  })
})

test.group('type predicates', () => {
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

  test('hook types reject invalid writes with or without Lucid context', ({ expectTypeOf }) => {
    const options = jsonColumn('heroes', 'active', isBoolean)
    expectTypeOf(options.prepare).parameters.toEqualTypeOf<
      [value: boolean | null, attribute?: string, model?: LucidRow]
    >()
    expectTypeOf(options.consume).returns.toEqualTypeOf<boolean | null>()
    expectTypeOf(options.prepare(true)).toEqualTypeOf<string | null>()
    expectTypeOf(options.prepare(true, 'active', new (class extends BaseModel {})())).toEqualTypeOf<
      string | null
    >()
    expectTypeOf(options.consume(true)).toEqualTypeOf<boolean | null>()
    expectTypeOf(options.consume(true, 'active', new (class extends BaseModel {})())).toEqualTypeOf<
      boolean | null
    >()
    if (process.env.TYPECHECK_ONLY) {
      // @ts-expect-error invalid value stays invalid with Lucid context
      options.prepare('yes', 'active', new (class extends BaseModel {})())
      // @ts-expect-error invalid value stays invalid without context
      options.prepare('yes')
    }
  })

  test('dynamic and partial allowlists preserve possible values in the false branch', ({
    assert,
    expectTypeOf,
  }) => {
    const isDynamic = isOneOf(['a', 'b'] as ('a' | 'b')[])
    const value = 'c' as 'a' | 'b' | 'c' | number
    if (isDynamic(value)) {
      expectTypeOf(value).toExtend<'a' | 'b'>()
    } else {
      expectTypeOf(value).toEqualTypeOf<'a' | 'b' | 'c' | number>()
    }
    const broadTuple: readonly [string] = ['red']
    const isBroadTuple = isOneOf(broadTuple)
    assert.isFalse(isBroadTuple('blue'))
    const mixed = 'blue' as string | number
    if (isBroadTuple(mixed)) {
      expectTypeOf(mixed).toExtend<string>()
    } else {
      expectTypeOf(mixed).toEqualTypeOf<string | number>()
    }
    const partialTuple: readonly ['red' | 'blue'] = ['red']
    const isPartialTuple = isOneOf(partialTuple)
    assert.isFalse(isPartialTuple('blue'))
    const color = 'blue' as 'red' | 'blue' | number
    if (isPartialTuple(color)) {
      expectTypeOf(color).toExtend<'red' | 'blue'>()
    } else {
      expectTypeOf(color).toEqualTypeOf<'red' | 'blue' | number>()
    }
  })

  test('alternative exact tuples preserve possible values on a membership miss', ({
    assert,
    expectTypeOf,
  }) => {
    function enabledLocalePolicy(locales: readonly ['en-GB'] | readonly ['en-NZ']) {
      const isEnabled = isOneOf(locales)
      return (locale: 'en-GB' | 'en-NZ' | number) => {
        if (isEnabled(locale)) {
          expectTypeOf(locale).toExtend<'en-GB' | 'en-NZ'>()
          return true
        }
        expectTypeOf(locale).toEqualTypeOf<'en-GB' | 'en-NZ' | number>()
        return false
      }
    }

    const isEnabled = enabledLocalePolicy(['en-GB'])
    assert.isTrue(isEnabled('en-GB'))
    assert.isFalse(isEnabled('en-NZ'))
  })

  test('singleton patterns preserve the false branch while singleton literals narrow it', ({
    assert,
    expectTypeOf,
  }) => {
    type Locale = `en-${string}`
    const enabled: readonly [Locale] = ['en-GB']
    const isEnabled = isOneOf(enabled)
    const locale = 'en-NZ' as Locale | number
    if (isEnabled(locale)) {
      expectTypeOf(locale).toExtend<Locale>()
      assert.fail('unlisted locale validated')
    } else {
      expectTypeOf(locale).toEqualTypeOf<Locale | number>()
    }

    const isBritishEnglish = isOneOf(['en-GB'])
    const exact = 'en-NZ' as 'en-GB' | 'en-NZ'
    if (isBritishEnglish(exact)) {
      expectTypeOf(exact).toEqualTypeOf<'en-GB'>()
    } else {
      expectTypeOf(exact).toEqualTypeOf<'en-NZ'>()
    }
  })

  test('failed dense array validation preserves the array type in the false branch', ({
    assert,
    expectTypeOf,
  }) => {
    const isFlags = isArrayOf(isBoolean)
    const sparse: boolean[] | string = new Array<boolean>(2) as boolean[] | string
    if (isFlags(sparse)) {
      expectTypeOf(sparse).toExtend<boolean[]>()
      assert.fail('sparse array validated')
    } else {
      expectTypeOf(sparse).toEqualTypeOf<boolean[] | string>()
    }

    const options = jsonColumn('heroes', 'flags', isArrayOf(isFlags))
    const ordinary: boolean[][] = [[true, false]]
    assert.equal(options.prepare(ordinary), '[[true,false]]')
  })

  test('isArrayOf accepts only arrays whose every element is valid', ({ assert }) => {
    const isFlags = isArrayOf(isBoolean)
    assert.isTrue(isFlags([]))
    assert.isTrue(isFlags([true, false]))
    assert.isFalse(isFlags([true, 'false']))
    assert.isFalse(isFlags('[true]'))
    assert.isFalse(isFlags(Array(1)))
    assert.throws(
      () => jsonColumn('heroes', 'flags', isFlags).consume(Array(1)),
      'Invalid persisted JSON in heroes.flags'
    )
  })
  test('isOneOf keeps the membership of a mutable exact tuple at creation', ({
    assert,
    expectTypeOf,
  }) => {
    const values: ['Batman', 1] = ['Batman', 1]
    const accepts = isOneOf(values)
    values.pop()
    values.reverse()
    values.push('Batman')

    const listed = 1 as 1 | 2
    if (accepts(listed)) {
      expectTypeOf(listed).toExtend<1>()
    } else {
      assert.fail('the original type predicate rejected a removed member')
    }

    const unlisted = 2 as 1 | 2
    if (accepts(unlisted)) {
      assert.fail('the original type predicate accepted an unlisted value')
    } else {
      expectTypeOf(unlisted).toEqualTypeOf<1 | 2>()
    }

    const acceptsCurrentValues = isOneOf(values)
    function rejectUnlisted(value: 'Batman' | 1 | 2): 'Batman' | 1 | 2 {
      if (acceptsCurrentValues(value)) throw new Error('value is a member')
      expectTypeOf(value).toEqualTypeOf<'Batman' | 1 | 2>()
      return value
    }

    assert.equal(rejectUnlisted(1), 1)
  })

  test('a sparse allowlist cannot match undefined', ({ assert }) => {
    const values = Array(1) as string[]
    const accepts = isOneOf(values)
    assert.isFalse(accepts(undefined))
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
    class Child extends Hero {}
    Child.boot()
    assert.isTrue(isJsonColumn(Child.$getColumn('active')))
  })

  test('recognises metadata from a separate module evaluation', async ({ assert }) => {
    const copy = await import(new URL('../src/json_column.ts?copy=1', import.meta.url).href)
    assert.isTrue(isJsonColumn(copy.jsonColumn('heroes', 'active', isBoolean)))
    assert.isFalse(isJsonColumn({ meta: { json: true } }))
  })
})
