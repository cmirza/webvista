import { env, exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import {
  createFavorite,
  listFavorites,
} from '../src/services/favorites'
import {
  renderFavoriteIconPreview,
} from '../src/views/partials/favorite-form'

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

async function adminRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const cookie = await adminCookie()
  const headers = new Headers(init.headers)
  headers.set('Cookie', cookie)

  if (init.method && init.method !== 'GET') {
    headers.set('Origin', origin)
  }

  return workerExports.default.fetch(
    new Request(`${origin}${path}`, { ...init, headers, redirect: 'manual' }),
  )
}

describe('add favorite', () => {
  it('renders a complete normal form and an HTMX fragment', async () => {
    const pageResponse = await adminRequest('/admin/favorites/new')
    const page = await pageResponse.text()
    const fragmentResponse = await adminRequest('/admin/favorites/new', {
      headers: { 'HX-Request': 'true' },
    })
    const fragment = await fragmentResponse.text()

    expect(pageResponse.status).toBe(200)
    expect(page).toContain('<!doctype html>')
    expect(page).toContain('<title>Add Site · WebVista</title>')
    expect(page).toContain('action="/admin/favorites"')
    expect(page).toContain('name="title"')
    expect(page).toContain('name="url"')
    expect(page).toContain('value="auto"')
    expect(page).toContain('value="fallback"')
    expect(page).toContain('value="upload" disabled')
    expect(fragmentResponse.status).toBe(200)
    expect(fragment).not.toContain('<!doctype html>')
    expect(fragment).toContain('hx-post="/admin/favorites"')
    expect(fragment).toContain('name="presentation" value="dashboard"')
  })

  it('creates a favorite through a normal form submission and redirects', async () => {
    const response = await adminRequest('/admin/favorites', {
      body: new URLSearchParams({
        title: ' Example Docs ',
        url: 'HTTPS://EXAMPLE.COM/docs#intro',
        iconMode: 'fallback',
      }),
      method: 'POST',
    })
    const favorites = await listFavorites(env.DB)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin')
    expect(favorites).toHaveLength(1)
    expect(favorites[0]).toMatchObject({
      title: 'Example Docs',
      url: 'https://example.com/docs',
      iconMode: 'fallback',
      iconUrl: null,
    })
  })

  it('returns an HTMX success fragment that appends the new row', async () => {
    const response = await adminRequest('/admin/favorites', {
      body: new URLSearchParams({
        title: 'HTMX Site',
        url: 'https://htmx.example',
        iconMode: 'fallback',
        presentation: 'dashboard',
      }),
      headers: { 'HX-Request': 'true' },
      method: 'POST',
    })
    const body = await response.text()
    const [favorite] = await listFavorites(env.DB)

    expect(response.status).toBe(200)
    expect(body).not.toContain('<!doctype html>')
    expect(body).toContain('<strong>HTMX Site</strong> was added to Favorites.')
    expect(body).toContain(`data-favorite-id="${favorite.id}"`)
    expect(body).toContain('hx-swap-oob="beforeend:#admin-favorites-list"')
    expect(body).toContain('id="favorites-count"')
    expect(body).toContain('hx-swap-oob="delete"')
  })

  it('returns field errors while preserving valid form input', async () => {
    const response = await adminRequest('/admin/favorites', {
      body: new URLSearchParams({
        title: '   ',
        url: 'not-a-url',
        iconMode: 'fallback',
      }),
      method: 'POST',
    })
    const body = await response.text()

    expect(response.status).toBe(422)
    expect(body).toContain('<!doctype html>')
    expect(body).toContain('Enter a display name.')
    expect(body).toContain(
      'Enter a complete web address beginning with http:// or https://.',
    )
    expect(body).toContain('value="not-a-url"')
    await expect(listFavorites(env.DB)).resolves.toEqual([])
  })

  it('swaps HTMX validation errors through the form shell', async () => {
    const response = await adminRequest('/admin/favorites', {
      body: new URLSearchParams({
        title: '',
        url: 'https://example.com',
        iconMode: 'fallback',
        presentation: 'dashboard',
      }),
      headers: { 'HX-Request': 'true' },
      method: 'POST',
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).not.toContain('<!doctype html>')
    expect(body).toContain('id="favorite-form-shell"')
    expect(body).toContain('Enter a display name.')
  })

  it('rejects duplicate URLs without discarding entered values', async () => {
    await createFavorite(env.DB, {
      title: 'Existing',
      url: 'https://example.com',
      iconMode: 'fallback',
    })
    const response = await adminRequest('/admin/favorites', {
      body: new URLSearchParams({
        title: 'Duplicate',
        url: 'HTTPS://EXAMPLE.COM/#different',
        iconMode: 'fallback',
      }),
      method: 'POST',
    })
    const body = await response.text()

    expect(response.status).toBe(422)
    expect(body).toContain('This web address is already in Favorites.')
    expect(body).toContain('value="Duplicate"')
    await expect(listFavorites(env.DB)).resolves.toHaveLength(1)
  })

  it('falls back safely when automatic metadata cannot be retrieved', async () => {
    const response = await adminRequest('/admin/favorites', {
      body: new URLSearchParams({
        title: 'Local Router',
        url: 'http://127.0.0.1/',
        iconMode: 'auto',
      }),
      method: 'POST',
    })
    const [favorite] = await listFavorites(env.DB)

    expect(response.status).toBe(303)
    expect(favorite).toMatchObject({
      title: 'Local Router',
      iconMode: 'auto',
      iconUrl: null,
    })
  })

  it('returns validation and fallback states from the icon preview route', async () => {
    const invalidResponse = await adminRequest(
      '/admin/favorites/icon-preview?url=invalid&title=Example',
      { headers: { 'HX-Request': 'true' } },
    )
    const invalid = await invalidResponse.text()
    const fallbackResponse = await adminRequest(
      '/admin/favorites/icon-preview?url=http%3A%2F%2F127.0.0.1%2F&title=Router&iconMode=auto',
      { headers: { 'HX-Request': 'true' } },
    )
    const fallback = await fallbackResponse.text()

    expect(invalidResponse.status).toBe(200)
    expect(invalid).toContain(
      'Enter a complete web address beginning with http:// or https://.',
    )
    expect(fallbackResponse.status).toBe(200)
    expect(fallback).toContain('data-icon-preview-result')
    expect(fallback).toContain('generated fallback will be used')
  })

  it('fills a blank title from metadata but preserves a manual override', async () => {
    const metadata = {
      pageUrl: 'https://example.com/',
      title: 'Suggested Site',
      icon: {
        url: 'https://example.com/icon.png',
        source: 'apple-touch-icon' as const,
        width: 180,
        height: 180,
        type: 'image/png',
      },
      failure: null,
    }
    const suggested = String(
      await renderFavoriteIconPreview(
        { title: '', url: metadata.pageUrl, iconMode: 'auto' },
        metadata,
      ),
    )
    const overridden = String(
      await renderFavoriteIconPreview(
        { title: 'My Name', url: metadata.pageUrl, iconMode: 'auto' },
        metadata,
      ),
    )

    expect(suggested).toContain('hx-swap-oob="outerHTML"')
    expect(suggested).toContain('value="Suggested Site"')
    expect(overridden).toContain('My Name')
    expect(overridden).toContain('Suggested name: Suggested Site')
    expect(overridden).toContain('Your display name will be kept.')
    expect(overridden).not.toContain('hx-swap-oob="outerHTML"')
  })
})
