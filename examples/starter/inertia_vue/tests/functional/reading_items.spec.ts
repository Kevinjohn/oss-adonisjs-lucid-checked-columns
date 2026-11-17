import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import ReadingItem from '#models/reading_item'

test.group('reading items', (group) => {
  group.each.setup(async () => {
    await db.from('reading_items').delete()
    await db.from('users').delete()
  })

  test('signed-in user saves and reads a checked label', async ({ client, assert }) => {
    const user = await User.create({ email: 'reader@example.test', password: 'password123' })
    const created = await client
      .post('/reading-items')
      .loginAs(user)
      .withCsrfToken()
      .form({ title: 'Lucid guide', label: 'reference' })
    created.assertStatus(200)
    const item = await ReadingItem.query().where('user_id', user.id).firstOrFail()
    assert.equal(item.title, 'Lucid guide')
    assert.deepEqual(item.labels, ['reference'])
    const page = await client.get('/reading-items').loginAs(user)
    page.assertStatus(200)
    assert.include(page.text(), 'Lucid guide')
  })

  test('rejects invalid persisted labels on a model read', async ({ assert, client }) => {
    const user = await User.create({ email: 'reader@example.test', password: 'password123' })
    const [id] = await db
      .table('reading_items')
      .insert({ user_id: user.id, title: 'Bad row', labels: '["unknown"]' })
    await assert.rejects(
      () => ReadingItem.findOrFail(id),
      /Invalid persisted JSON in reading_items.labels/
    )
    const page = await client.get('/reading-items').loginAs(user)
    page.assertStatus(500)
    assert.notInclude(page.text(), 'Invalid persisted JSON in reading_items.labels')
  })
})
