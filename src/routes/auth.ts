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

const safeAdminDestination = (value: string | undefined): string => {
  if (!value) return '/admin'

  try {
    const destination = new URL(value, 'https://webvista.invalid')
    if (
      destination.origin !== 'https://webvista.invalid' ||
      !(
        destination.pathname === '/admin' ||
        destination.pathname.startsWith('/admin/')
      ) ||
      destination.pathname === '/admin/login'
    ) {
      return '/admin'
    }
    return `${destination.pathname}${destination.search}`
  } catch {
    return '/admin'
  }
}

authRoutes.get('/login', async (context) => {
  context.header('Cache-Control', 'no-store')
  const next = safeAdminDestination(context.req.query('next'))
  if (await hasAdminSession(context)) {
    return context.redirect(next, 303)
  }

  const unavailable = !isAuthConfigured(context.env)
  return context.html(
    await renderAdminLogin({ next, unavailable }),
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
  const next = safeAdminDestination(
    typeof body.next === 'string' ? body.next : undefined,
  )

  if (!(await passwordsMatch(password, context.env.ADMIN_PASSWORD))) {
    return context.html(
      await renderAdminLogin({
        error: 'The password was not accepted.',
        next,
      }),
      401,
    )
  }

  await startAdminSession(context)
  return context.redirect(next, 303)
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
