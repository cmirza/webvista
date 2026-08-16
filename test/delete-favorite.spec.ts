import { env, exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import {
  createFavorite,
  getFavorite,
  listFavorites,
} from '../src/services/favorites'
import { storeCustomIcon } from '../src/services/icon-storage'

const origin = 'https://webvista.test'
const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
])

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

async function adminRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Cookie', await adminCookie())

  if (init.method && init.method !== 'GET') {
    headers.set('Origin', origin)
  }

  return workerExports.default.fetch(
    new Request(`${origin}${path}`, { ...init, headers, redirect: 'manual' }),
  )
}

describe('delete favorite', () => {
  it('renders a named full-page confirmation and an HTMX fragment', async () => {
    const favorite = await createFavorite(env.DB, {
      title: 'Example & News',
      url: 'https://example.com/news',
      iconMode: 'fallback',
    })
    const pageResponse = await adminRequest(
      `/admin/favorites/${favorite.id}/delete`,
    )
    const page = await pageResponse.text()
    const fragmentResponse = await adminRequest(
      `/admin/favorites/${favorite.id}/delete`,
      { headers: { 'HX-Request': 'true' } },
    )
    const fragment = await fragmentResponse.text()

    expect(pageResponse.status).toBe(200)
    expect(page).toContain('<title>Remove Site · WebVista</title>')
    expect(page).toContain('Remove Favorite?')
    expect(page).toContain('Example &amp; News')
    expect(page).toContain(
      `action="/admin/favorites/${favorite.id}/delete"`,
    )
    expect(page).toContain('name="confirmed" value="yes"')
    expect(page).toContain('href="/admin">Cancel</a>')
    expect(fragmentResponse.status).toBe(200)
    expect(fragment).not.toContain('<!doctype html>')
    expect(fragment).toContain(`hx-delete="/admin/favorites/${favorite.id}"`)
    expect(fragment).toContain('name="presentation" value="dashboard"')
  })

  it('deletes through the normal HTML fallback and redirects', async () => {
    const favorite = await createFavorite(env.DB, {
      title: 'Normal Delete',
      url: 'https://normal-delete.example',
      iconMode: 'fallback',
    })
    const response = await adminRequest(
      `/admin/favorites/${favorite.id}/delete`,
      {
        body: new URLSearchParams({ confirmed: 'yes' }),
        method: 'POST',
      },
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin')
    await expect(getFavorite(env.DB, favorite.id)).resolves.toBeNull()
  })

  it('removes the row, updates the count, and renders the empty state through HTMX', async () => {
    const favorite = await createFavorite(env.DB, {
      title: 'Only Favorite',
      url: 'https://only.example',
      iconMode: 'fallback',
    })
    const response = await adminRequest(`/admin/favorites/${favorite.id}`, {
      body: new URLSearchParams({
        confirmed: 'yes',
        presentation: 'dashboard',
      }),
      headers: { 'HX-Request': 'true' },
      method: 'DELETE',
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).not.toContain('<!doctype html>')
    expect(body).toContain('<strong>Only Favorite</strong> was removed.')
    expect(body).toContain(
      `id="admin-favorite-${favorite.id}" hx-swap-oob="delete"`,
    )
    expect(body).toContain('aria-label="0 favorites"')
    expect(body).toContain('hx-swap-oob="afterend:#admin-favorites-list"')
    expect(body).toContain('No favorites yet')
    await expect(listFavorites(env.DB)).resolves.toEqual([])
  })

  it('deletes an associated uploaded icon only after deleting its favorite', async () => {
    const iconStorageKey = await storeCustomIcon(
      env.ICONS,
      new File([pngBytes], 'custom.png', { type: 'image/png' }),
    )
    const favorite = await createFavorite(env.DB, {
      title: 'Uploaded Favorite',
      url: 'https://uploaded.example',
      iconMode: 'upload',
      iconStorageKey,
    })

    const response = await adminRequest(`/admin/favorites/${favorite.id}`, {
      body: new URLSearchParams({ confirmed: 'yes' }),
      headers: { 'HX-Request': 'true' },
      method: 'DELETE',
    })

    expect(response.status).toBe(200)
    await expect(getFavorite(env.DB, favorite.id)).resolves.toBeNull()
    await expect(env.ICONS.get(iconStorageKey)).resolves.toBeNull()
  })

  it('requires explicit confirmation and leaves the favorite untouched', async () => {
    const favorite = await createFavorite(env.DB, {
      title: 'Keep Me',
      url: 'https://keep.example',
      iconMode: 'fallback',
    })

    for (const [path, method] of [
      [`/admin/favorites/${favorite.id}/delete`, 'POST'],
      [`/admin/favorites/${favorite.id}`, 'DELETE'],
    ] as const) {
      const response = await adminRequest(path, {
        body: new URLSearchParams(),
        method,
      })
      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Confirmation required.')
    }

    await expect(getFavorite(env.DB, favorite.id)).resolves.toEqual(favorite)
  })

  it('handles missing favorites and protects the delete endpoint', async () => {
    const missingGet = await adminRequest('/admin/favorites/missing/delete')
    const missingPost = await adminRequest('/admin/favorites/missing/delete', {
      body: new URLSearchParams({ confirmed: 'yes' }),
      method: 'POST',
    })
    const missingDelete = await adminRequest('/admin/favorites/missing', {
      body: new URLSearchParams({ confirmed: 'yes' }),
      method: 'DELETE',
    })
    const unauthorized = await workerExports.default.fetch(
      new Request(`${origin}/admin/favorites/missing`, {
        body: new URLSearchParams({ confirmed: 'yes' }),
        headers: { Origin: origin },
        method: 'DELETE',
      }),
    )
    const cookie = await adminCookie()
    const crossOrigin = await workerExports.default.fetch(
      new Request(`${origin}/admin/favorites/missing`, {
        body: new URLSearchParams({ confirmed: 'yes' }),
        headers: { Cookie: cookie, Origin: 'https://attacker.example' },
        method: 'DELETE',
      }),
    )

    expect(missingGet.status).toBe(404)
    expect(missingPost.status).toBe(404)
    expect(missingDelete.status).toBe(404)
    expect(unauthorized.status).toBe(401)
    expect(crossOrigin.status).toBe(403)
  })
})
