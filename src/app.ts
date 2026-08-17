import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { iconRoutes } from './routes/icons'
import { portalRoutes } from './routes/portal'
import {
  renderAdminServiceError,
  renderPortalServiceError,
} from './views/error'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.route('/', portalRoutes)
app.route('/icons', iconRoutes)
app.route('/admin', authRoutes)
app.route('/admin', adminRoutes)

app.notFound((context) => context.text('Not found', 404))

app.onError(async (error, context) => {
  if (error instanceof HTTPException) {
    return error.getResponse()
  }

  context.header('Cache-Control', 'no-store')

  if (context.req.path.startsWith('/admin')) {
    const enhanced = context.req.header('HX-Request') === 'true'
    return context.html(await renderAdminServiceError(enhanced), 503)
  }

  return context.html(await renderPortalServiceError(), 503)
})

export default app
