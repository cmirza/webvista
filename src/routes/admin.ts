import { Hono } from 'hono'
import {
  requireAdmin,
  requireSameOriginForWrites,
} from '../middleware/auth'
import { listFavorites } from '../services/favorites'
import { renderAdminDashboard } from '../views/admin'

export const adminRoutes = new Hono<{ Bindings: CloudflareBindings }>()

adminRoutes.use('*', requireAdmin)
adminRoutes.use('*', requireSameOriginForWrites)

adminRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store')
  const favorites = await listFavorites(context.env.DB)
  return context.html(await renderAdminDashboard(favorites))
})

adminRoutes.all('*', (context) => context.notFound())
