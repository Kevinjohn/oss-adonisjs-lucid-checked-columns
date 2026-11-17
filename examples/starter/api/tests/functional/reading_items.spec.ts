import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import ReadingItem from '#models/reading_item'

test.group('reading items', (group) => {
  group.each.setup(async () => {
    await db.from('reading_items').delete()
    await db.from('auth_access_tokens').delete()
    await db.from('users').delete()
  })

  test('bearer user creates and reads checked labels', async ({ client, assert }) => {
    const user = await User.create({ email: 'reader@example.test', password: 'password123' })
    const accessToken = await User.accessTokens.create(user)
    const token = accessToken.value!.release()
    const created = await client
      .post('/api/v1/account/reading-items')
      .header('Authorization', `Bearer ${token}`)
      .json({ title: 'Lucid guide', labels: ['reference'] })
    created.assertStatus(201)
    assert.deepEqual(created.body().labels, ['reference'])

    const listed = await client
      .get('/api/v1/account/reading-items')
      .header('Authorization', `Bearer ${token}`)
    listed.assertStatus(200)
    assert.deepEqual(listed.body().items[0].labels, ['reference'])
    assert.equal(listed.body().items[0].title, 'Lucid guide')
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
    const accessToken = await User.accessTokens.create(user)
    const response = await client
      .get('/api/v1/account/reading-items')
      .header('Authorization', `Bearer ${accessToken.value!.release()}`)
    response.assertStatus(500)
    assert.notInclude(response.text(), 'Invalid persisted JSON in reading_items.labels')
  })
})
