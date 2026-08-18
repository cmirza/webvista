import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import { beforeEach, inject } from 'vitest'

beforeEach(async () => {
  await applyD1Migrations(env.DB, inject('migrations'))
  await env.DB
    .prepare(
      "UPDATE portal_settings SET value = '1' WHERE key = 'for_you_enabled'",
    )
    .run()
  await env.DB.prepare('DELETE FROM for_you_items').run()
  await env.DB.prepare('DELETE FROM watch_items').run()
  await env.DB.prepare('DELETE FROM favorites').run()
  let cursor: string | undefined

  do {
    const objects = await env.ICONS.list({ cursor })
    if (objects.objects.length > 0) {
      await env.ICONS.delete(objects.objects.map(({ key }) => key))
    }
    cursor = objects.truncated ? objects.cursor : undefined
  } while (cursor)
})
