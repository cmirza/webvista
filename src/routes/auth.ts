import { Hono } from 'hono'
import { renderAdminUnavailable } from '../views/admin'

export const authRoutes = new Hono<{ Bindings: CloudflareBindings }>()

authRoutes.get('/login', async (context) => {
  context.header('Cache-Control', 'no-store')
  return context.html(await renderAdminUnavailable(), 503)
})
