import { Hono } from 'hono'
import {
  requireAdmin,
  requireSameOriginForWrites,
} from '../middleware/auth'
import { renderAuthenticatedAdmin } from '../views/admin'

export const adminRoutes = new Hono<{ Bindings: CloudflareBindings }>()

adminRoutes.use('*', requireAdmin)
adminRoutes.use('*', requireSameOriginForWrites)

adminRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store')
  return context.html(await renderAuthenticatedAdmin())
})

adminRoutes.all('*', (context) => context.notFound())
