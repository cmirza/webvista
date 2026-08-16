import { env, exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { createFavorite } from '../src/services/favorites'

const origin = 'https://webvista.test'

async function authenticatedAdminRequest(): Promise<Response> {
  const loginResponse = await workerExports.default.fetch(
    new Request(`${origin}/admin/login`, {
      body: new URLSearchParams({ password: env.ADMIN_PASSWORD }),
      headers: { Origin: origin },
      method: 'POST',
      redirect: 'manual',
    }),
  )
  const cookie = loginResponse.headers.get('set-cookie')?.split(';', 1)[0]

  expect(loginResponse.status).toBe(303)
  expect(cookie).toBeTruthy()

  return workerExports.default.fetch(
    new Request(`${origin}/admin`, { headers: { Cookie: cookie! } }),
  )
}

describe('admin dashboard', () => {
  it('renders a useful empty state', async () => {
    const response = await authenticatedAdminRequest()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toContain('<h1 class="mt-1 text-3xl font-semibold tracking-tight">WebVista Admin</h1>')
    expect(body).toContain('aria-label="0 favorites"')
    expect(body).toContain('No favorites yet')
    expect(body).toContain('Add Site')
    expect(body).not.toContain('data-admin-favorite-row')
  })

  it('renders all favorites in stored order with management details', async () => {
    const first = await createFavorite(env.DB, {
      title: 'Example & Search',
      url: 'https://www.example.com/search',
      iconMode: 'auto',
      iconUrl: 'https://cdn.example.com/icon.png',
    })
    const second = await createFavorite(env.DB, {
      title: 'Hidden News',
      url: 'https://news.example/articles',
      enabled: false,
      iconMode: 'fallback',
    })

    const response = await authenticatedAdminRequest()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('aria-label="2 favorites"')
    expect(body).toContain('data-admin-favorites-list')
    expect(body).toContain(`data-favorite-id="${first.id}"`)
    expect(body).toContain(`data-favorite-id="${second.id}"`)
    expect(body.indexOf(first.id)).toBeLessThan(body.indexOf(second.id))
    expect(body).toContain('Example &amp; Search')
    expect(body).toContain('example.com')
    expect(body).toContain('news.example')
    expect(body).toContain('Hidden')
    expect(body).toContain('src="https://cdn.example.com/icon.png"')
    expect(body).toContain('referrerpolicy="no-referrer"')
    expect(body).toContain('Edit')
    expect(body).toContain(`/admin/favorites/${first.id}/edit`)
    expect(body).toContain('hx-swap="innerHTML show:#admin-workspace:top"')
    expect(body).toContain('Remove')
    expect(body).toContain('Drag-and-drop ordering will be enabled in a later step.')
  })
})
