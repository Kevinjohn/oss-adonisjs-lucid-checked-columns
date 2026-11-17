import ReadingItem from '#models/reading_item'
import { readingItemValidator } from '#validators/reading_item'
import type { HttpContext } from '@adonisjs/core/http'

export default class ReadingItemsController {
  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    let items: ReadingItem[]
    try {
      items = await ReadingItem.query().where('user_id', user.id).orderBy('id', 'desc')
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Invalid persisted JSON in reading_items.labels'
      ) {
        return response.internalServerError({ message: 'Reading list unavailable' })
      }
      throw error
    }
    return { items: items.map((item) => ({ id: item.id, title: item.title, labels: item.labels })) }
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { title, labels } = await request.validateUsing(readingItemValidator)
    const item = await ReadingItem.create({ userId: user.id, title, labels })
    return response.created({ id: item.id, title: item.title, labels: item.labels })
  }
}
