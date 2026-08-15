import { Hono } from 'hono'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get('/', (context) => {
  return context.text('WebVista is getting ready.')
})

export default app
