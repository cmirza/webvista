import { Hono } from 'hono'
import { listFavorites } from '../services/favorites'
import { renderPortal } from '../views/portal'

export const portalRoutes = new Hono<{ Bindings: CloudflareBindings }>()

portalRoutes.get('/', async (context) => {
  const favorites = await listFavorites(context.env.DB, { enabledOnly: true })
  return context.html(await renderPortal(favorites))
})
