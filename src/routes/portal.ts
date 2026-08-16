import { Hono } from 'hono'
import { renderPortal } from '../views/portal'

export const portalRoutes = new Hono<{ Bindings: CloudflareBindings }>()

portalRoutes.get('/', async (context) => {
  return context.html(await renderPortal())
})
