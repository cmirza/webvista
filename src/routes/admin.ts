import { Hono } from 'hono'

export const adminRoutes = new Hono<{ Bindings: CloudflareBindings }>()

adminRoutes.all('*', (context) => context.redirect('/admin/login', 303))
