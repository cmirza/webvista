import { Hono } from 'hono'
import {
  endAdminSession,
  hasAdminSession,
  isAuthConfigured,
  passwordsMatch,
  requireAdmin,
  requireSameOriginForWrites,
  startAdminSession,
} from '../middleware/auth'
import { renderAdminLogin } from '../views/admin'

export const authRoutes = new Hono<{ Bindings: CloudflareBindings }>()

authRoutes.get('/login', async (context) => {
  context.header('Cache-Control', 'no-store')
  if (await hasAdminSession(context)) {
    return context.redirect('/admin', 303)
  }

  const unavailable = !isAuthConfigured(context.env)
  return context.html(
    await renderAdminLogin({ unavailable }),
    unavailable ? 503 : 200,
  )
})

authRoutes.post('/login', requireSameOriginForWrites, async (context) => {
  context.header('Cache-Control', 'no-store')
  if (!isAuthConfigured(context.env)) {
    return context.html(await renderAdminLogin({ unavailable: true }), 503)
  }

  const body = await context.req.parseBody()
  const password = typeof body.password === 'string' ? body.password : ''

  if (!(await passwordsMatch(password, context.env.ADMIN_PASSWORD))) {
    return context.html(
      await renderAdminLogin({ error: 'The password was not accepted.' }),
      401,
    )
  }

  await startAdminSession(context)
  return context.redirect('/admin', 303)
})

authRoutes.post(
  '/logout',
  requireAdmin,
  requireSameOriginForWrites,
  (context) => {
    context.header('Cache-Control', 'no-store')
    endAdminSession(context)
    return context.redirect('/admin/login', 303)
  },
)
