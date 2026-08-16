import { Hono } from 'hono'
import { customIconKey } from '../services/icon-storage'

export const iconRoutes = new Hono<{ Bindings: CloudflareBindings }>()

iconRoutes.get('/:fileName', async (context) => {
  const key = customIconKey(context.req.param('fileName'))

  if (!key) {
    return context.notFound()
  }

  const object = await context.env.ICONS.get(key)

  if (!object) {
    return context.notFound()
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('ETag', object.httpEtag)
  headers.set('X-Content-Type-Options', 'nosniff')

  return new Response(object.body, { headers })
})
