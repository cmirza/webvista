import { env, exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { createFavorite, listFavorites } from '../src/services/favorites'

const origin = 'https://webvista.test'

async function adminCookie(): Promise<string> {
  const response = await workerExports.default.fetch(
    new Request(`${origin}/admin/login`, {
      body: new URLSearchParams({ password: env.ADMIN_PASSWORD }),
      headers: { Origin: origin },
      method: 'POST',
      redirect: 'manual',
    }),
  )

  expect(response.status).toBe(303)
  return response.headers.get('set-cookie')!.split(';', 1)[0]
}

async function reorder(body: string): Promise<Response> {
  return workerExports.default.fetch(
    new Request(`${origin}/admin/favorites/reorder`, {
      body,
      headers: {
        'Content-Type': 'application/json',
        Cookie: await adminCookie(),
        Origin: origin,
      },
      method: 'POST',
    }),
  )
}

describe('reorder favorites', () => {
  it('persists a complete order and immediately changes the public portal', async () => {
    const first = await createFavorite(env.DB, {
      title: 'First',
      url: 'https://first.example',
      iconMode: 'fallback',
    })
    const second = await createFavorite(env.DB, {
      title: 'Second',
      url: 'https://second.example',
      iconMode: 'fallback',
    })
    const third = await createFavorite(env.DB, {
      title: 'Third',
      url: 'https://third.example',
      iconMode: 'fallback',
    })

    const response = await reorder(
      JSON.stringify({ ids: [third.id, first.id, second.id] }),
    )
    const stored = await listFavorites(env.DB)
    const portal = await workerExports.default.fetch(
      new Request(`${origin}/`),
    )
    const portalBody = await portal.text()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(stored.map(({ id, position }) => ({ id, position }))).toEqual([
      { id: third.id, position: 10 },
      { id: first.id, position: 20 },
      { id: second.id, position: 30 },
    ])
    expect(portalBody.indexOf('Third')).toBeLessThan(
      portalBody.indexOf('First'),
    )
    expect(portalBody.indexOf('First')).toBeLessThan(
      portalBody.indexOf('Second'),
    )
  })

  it('rejects malformed JSON and invalid payload shapes', async () => {
    for (const body of [
      '{',
      '{}',
      JSON.stringify({ ids: 'favorite-one' }),
      JSON.stringify({ ids: [1] }),
      JSON.stringify({ ids: [''] }),
    ]) {
      const response = await reorder(body)
      expect(response.status).toBe(400)
    }
  })

  it('rejects duplicate, missing, and unknown IDs without changing order', async () => {
    const first = await createFavorite(env.DB, {
      title: 'First',
      url: 'https://first.example',
    })
    const second = await createFavorite(env.DB, {
      title: 'Second',
      url: 'https://second.example',
    })

    for (const ids of [
      [first.id, first.id],
      [first.id],
      [first.id, 'unknown'],
    ]) {
      const response = await reorder(JSON.stringify({ ids }))
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toHaveProperty('error')
      expect((await listFavorites(env.DB)).map(({ id }) => id)).toEqual([
        first.id,
        second.id,
      ])
    }
  })
})
