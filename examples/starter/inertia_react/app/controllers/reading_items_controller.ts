import ReadingItem from '#models/reading_item'
import { readingItemValidator } from '#validators/reading_item'
import type { HttpContext } from '@adonisjs/core/http'

export default class ReadingItemsController {
  async index({ auth, inertia, response }: HttpContext) {
    const user = auth.getUserOrFail()
    let rows: ReadingItem[]
    try {
      rows = await ReadingItem.query().where('user_id', user.id).orderBy('id', 'desc')
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Invalid persisted JSON in reading_items.labels'
      ) {
        return response.internalServerError('Reading list unavailable')
      }
      throw error
    }
    const items = rows.map((item) => ({ id: item.id, title: item.title, labels: item.labels }))
    return inertia.render('reading_items', { items })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { title, label } = await request.validateUsing(readingItemValidator)
    await ReadingItem.create({ userId: user.id, title, labels: [label] })
    return response.redirect('/reading-items')
  }
}
