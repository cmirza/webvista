import { Hono } from 'hono'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { portalRoutes } from './routes/portal'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.route('/', portalRoutes)
app.route('/admin', authRoutes)
app.route('/admin', adminRoutes)

app.notFound((context) => context.text('Not found', 404))

export default app
