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
const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
])

const customIconForm = (
  overrides: Record<string, string> = {},
  file: File = new File([pngBytes], 'portal.png', { type: 'image/png' }),
): FormData => {
  const form = new FormData()
  const values = {
    title: 'Custom Icon Site',
    url: 'https://custom-icon.example',
    iconMode: 'upload',
    ...overrides,
  }

  Object.entries(values).forEach(([key, value]) => form.set(key, value))
  form.set('iconFile', file)
  return form
}

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
    expect(page).toContain('enctype="multipart/form-data"')
    expect(page).toContain('value="upload"')
    expect(page).toContain('name="iconFile"')
    expect(page).toContain('accept="image/png,image/jpeg,image/webp"')
    expect(page).toContain('<script src="/assets/admin.js" defer></script>')
    expect(fragmentResponse.status).toBe(200)
    expect(fragment).not.toContain('<!doctype html>')
    expect(fragment).toContain('hx-post="/admin/favorites"')
    expect(fragment).toContain('hx-encoding="multipart/form-data"')
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

  it('stores a validated custom icon and serves it through the public route', async () => {
    const response = await adminRequest('/admin/favorites', {
      body: customIconForm(),
      method: 'POST',
    })
    const [favorite] = await listFavorites(env.DB)

    expect(response.status).toBe(303)
    expect(favorite).toMatchObject({
      title: 'Custom Icon Site',
      iconMode: 'upload',
      iconUrl: null,
    })
    expect(favorite.iconStorageKey).toMatch(
      /^favorite-icons\/[0-9a-f-]{36}\.png$/,
    )

    const stored = await env.ICONS.get(favorite.iconStorageKey!)
    expect(stored).not.toBeNull()
    expect(stored?.httpMetadata?.contentType).toBe('image/png')
    expect(stored?.customMetadata).toEqual({ purpose: 'favorite-icon' })

    const fileName = favorite.iconStorageKey!.replace('favorite-icons/', '')
    const iconResponse = await workerExports.default.fetch(
      new Request(`${origin}/icons/${fileName}`),
    )

    expect(iconResponse.status).toBe(200)
    expect(iconResponse.headers.get('content-type')).toBe('image/png')
    expect(iconResponse.headers.get('cache-control')).toContain('immutable')
    expect(iconResponse.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await iconResponse.arrayBuffer())).toEqual(pngBytes)
  })

  it('rejects missing, unsupported, spoofed, and oversized custom icons', async () => {
    const missingForm = customIconForm()
    missingForm.delete('iconFile')
    const cases = [
      {
        form: missingForm,
        message: 'Choose a PNG, JPEG, or WebP image.',
      },
      {
        form: customIconForm(
          { url: 'https://unsupported.example' },
          new File(['plain text'], 'icon.txt', { type: 'text/plain' }),
        ),
        message: 'Choose a PNG, JPEG, or WebP image.',
      },
      {
        form: customIconForm(
          { url: 'https://spoofed.example' },
          new File(['not png'], 'icon.png', { type: 'image/png' }),
        ),
        message: 'does not appear to be a valid PNG, JPEG, or WebP image',
      },
      {
        form: customIconForm(
          { url: 'https://large.example' },
          new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', {
            type: 'image/png',
          }),
        ),
        message: 'Custom icons must be 2 MB or smaller.',
      },
    ]

    for (const { form, message } of cases) {
      const response = await adminRequest('/admin/favorites', {
        body: form,
        method: 'POST',
      })
      expect(response.status).toBe(422)
      expect(await response.text()).toContain(message)
    }

    await expect(listFavorites(env.DB)).resolves.toEqual([])
    await expect(env.ICONS.list()).resolves.toMatchObject({ objects: [] })
  })

  it('cleans up an uploaded object when favorite creation fails', async () => {
    await createFavorite(env.DB, {
      title: 'Existing',
      url: 'https://custom-icon.example',
      iconMode: 'fallback',
    })

    const response = await adminRequest('/admin/favorites', {
      body: customIconForm(),
      method: 'POST',
    })

    expect(response.status).toBe(422)
    expect(await response.text()).toContain(
      'This web address is already in Favorites.',
    )
    await expect(env.ICONS.list()).resolves.toMatchObject({ objects: [] })
  })

  it('returns 404 for invalid or missing custom icon objects', async () => {
    const invalid = await workerExports.default.fetch(
      new Request(`${origin}/icons/not-an-icon.png`),
    )
    const missing = await workerExports.default.fetch(
      new Request(
        `${origin}/icons/123e4567-e89b-42d3-a456-426614174000.png`,
      ),
    )

    expect(invalid.status).toBe(404)
    expect(missing.status).toBe(404)
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
