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

const pngFile = (name = 'icon.png') =>
  new File([pngBytes], name, { type: 'image/png' })

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

const editValues = (overrides: Record<string, string> = {}) =>
  new URLSearchParams({
    title: 'Updated Site',
    url: 'https://updated.example/',
    iconMode: 'fallback',
    automaticIconAction: 'refresh',
    enabled: '1',
    ...overrides,
  })

describe('edit favorite', () => {
  it('renders a full edit page and an HTMX fragment with the current values', async () => {
    const favorite = await createFavorite(env.DB, {
      title: 'Existing Site',
      url: 'https://existing.example',
      iconMode: 'auto',
      iconUrl: 'https://existing.example/icon.png',
    })
    const pageResponse = await adminRequest(
      `/admin/favorites/${favorite.id}/edit`,
    )
    const page = await pageResponse.text()
    const fragmentResponse = await adminRequest(
      `/admin/favorites/${favorite.id}/edit`,
      { headers: { 'HX-Request': 'true' } },
    )
    const fragment = await fragmentResponse.text()

    expect(pageResponse.status).toBe(200)
    expect(page).toContain('<title>Edit Site · WebVista</title>')
    expect(page).toContain('data-favorite-form-action="edit"')
    expect(page).toContain(`action="/admin/favorites/${favorite.id}"`)
    expect(page).toContain('value="Existing Site"')
    expect(page).toContain('value="https://existing.example/"')
    expect(page).toContain('Keep current icon')
    expect(page).toContain('Find icon from web address')
    expect(page).toContain('src="https://existing.example/icon.png"')
    expect(page).toContain('data-automatic-icon-preview')
    expect(page).toContain('Automatic icon preview')
    expect(page).toContain('Preview automatic icon')
    expect(page).toContain('data-upload-icon-preview')
    expect(page).not.toContain('No replacement preview selected.')
    expect(page).toContain('Save Changes')
    expect(fragmentResponse.status).toBe(200)
    expect(fragment).not.toContain('<!doctype html>')
    expect(fragment).toContain(`hx-post="/admin/favorites/${favorite.id}"`)
    expect(fragment).toContain('name="presentation" value="dashboard"')
  })

  it('hides automatic preview controls when another icon mode is selected', async () => {
    const favorite = await createFavorite(env.DB, {
      title: 'Fallback Site',
      url: 'https://fallback.example',
      iconMode: 'fallback',
    })
    const response = await adminRequest(`/admin/favorites/${favorite.id}/edit`)
    const page = await response.text()

    expect(response.status).toBe(200)
    expect(page).toMatch(/data-automatic-icon-preview\s+hidden/)
    expect(page).toContain('data-upload-icon-preview')
  })

  it('updates fields through a normal form and redirects', async () => {
    const favorite = await createFavorite(env.DB, {
      title: 'Original',
      url: 'https://original.example',
      iconMode: 'auto',
      iconUrl: 'https://original.example/icon.png',
    })
    const response = await adminRequest(`/admin/favorites/${favorite.id}`, {
      body: editValues({ enabled: '' }),
      method: 'POST',
    })
    const updated = await getFavorite(env.DB, favorite.id)

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin')
    expect(updated).toMatchObject({
      title: 'Updated Site',
      url: 'https://updated.example/',
      iconMode: 'fallback',
      iconUrl: null,
      iconStorageKey: null,
      enabled: false,
    })
  })

  it('returns an HTMX success fragment that replaces the dashboard row', async () => {
    const favorite = await createFavorite(env.DB, {
      title: 'Original',
      url: 'https://original.example',
      iconMode: 'fallback',
    })
    const response = await adminRequest(`/admin/favorites/${favorite.id}`, {
      body: editValues({ presentation: 'dashboard' }),
      headers: { 'HX-Request': 'true' },
      method: 'POST',
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).not.toContain('<!doctype html>')
    expect(body).toContain('<strong>Updated Site</strong> was updated.')
    expect(body).toContain('data-auto-dismiss="4500"')
    expect(body).not.toContain('>Done<')
    expect(body).toContain(`id="admin-favorite-${favorite.id}"`)
    expect(body).toContain('hx-swap-oob="outerHTML"')
  })

  it('keeps an automatic icon across a URL change unless refresh is selected', async () => {
    const kept = await createFavorite(env.DB, {
      title: 'Keep Icon',
      url: 'https://keep.example',
      iconMode: 'auto',
      iconUrl: 'https://keep.example/icon.png',
    })
    const refreshed = await createFavorite(env.DB, {
      title: 'Refresh Icon',
      url: 'https://refresh.example',
      iconMode: 'auto',
      iconUrl: 'https://refresh.example/icon.png',
    })

    await adminRequest(`/admin/favorites/${kept.id}`, {
      body: editValues({
        title: 'Keep Icon',
        url: 'https://new-address.example',
        iconMode: 'auto',
        automaticIconAction: 'keep',
      }),
      method: 'POST',
    })
    await adminRequest(`/admin/favorites/${refreshed.id}`, {
      body: editValues({
        title: 'Refresh Icon',
        url: 'http://127.0.0.1/',
        iconMode: 'auto',
        automaticIconAction: 'refresh',
      }),
      method: 'POST',
    })

    await expect(getFavorite(env.DB, kept.id)).resolves.toMatchObject({
      url: 'https://new-address.example/',
      iconUrl: 'https://keep.example/icon.png',
    })
    await expect(getFavorite(env.DB, refreshed.id)).resolves.toMatchObject({
      url: 'http://127.0.0.1/',
      iconUrl: null,
    })
  })

  it('replaces a custom icon and removes the previous R2 object', async () => {
    const previousKey = await storeCustomIcon(env.ICONS, pngFile('old.png'))
    const favorite = await createFavorite(env.DB, {
      title: 'Uploaded Icon',
      url: 'https://upload.example',
      iconMode: 'upload',
      iconStorageKey: previousKey,
    })
    const form = new FormData()
    form.set('title', favorite.title)
    form.set('url', favorite.url)
    form.set('iconMode', 'upload')
    form.set('automaticIconAction', 'refresh')
    form.set('enabled', '1')
    form.set('iconFile', pngFile('replacement.png'))

    const response = await adminRequest(`/admin/favorites/${favorite.id}`, {
      body: form,
      method: 'POST',
    })
    const updated = await getFavorite(env.DB, favorite.id)

    expect(response.status).toBe(303)
    expect(updated?.iconStorageKey).not.toBe(previousKey)
    await expect(env.ICONS.get(previousKey)).resolves.toBeNull()
    await expect(env.ICONS.get(updated!.iconStorageKey!)).resolves.not.toBeNull()
  })

  it('keeps an existing upload without a new file and removes it after switching modes', async () => {
    const previousKey = await storeCustomIcon(env.ICONS, pngFile('old.png'))
    const favorite = await createFavorite(env.DB, {
      title: 'Uploaded Icon',
      url: 'https://upload.example',
      iconMode: 'upload',
      iconStorageKey: previousKey,
    })
    const keptResponse = await adminRequest(
      `/admin/favorites/${favorite.id}`,
      {
        body: editValues({
          title: 'Renamed Upload',
          url: favorite.url,
          iconMode: 'upload',
        }),
        method: 'POST',
      },
    )

    expect(keptResponse.status).toBe(303)
    await expect(getFavorite(env.DB, favorite.id)).resolves.toMatchObject({
      title: 'Renamed Upload',
      iconStorageKey: previousKey,
    })
    await expect(env.ICONS.get(previousKey)).resolves.not.toBeNull()

    const fallbackResponse = await adminRequest(
      `/admin/favorites/${favorite.id}`,
      {
        body: editValues({
          title: 'Renamed Upload',
          url: favorite.url,
          iconMode: 'fallback',
        }),
        method: 'POST',
      },
    )

    expect(fallbackResponse.status).toBe(303)
    await expect(getFavorite(env.DB, favorite.id)).resolves.toMatchObject({
      iconMode: 'fallback',
      iconStorageKey: null,
    })
    await expect(env.ICONS.get(previousKey)).resolves.toBeNull()
  })

  it('preserves the previous upload when replacement validation fails', async () => {
    const previousKey = await storeCustomIcon(env.ICONS, pngFile('old.png'))
    const favorite = await createFavorite(env.DB, {
      title: 'Uploaded Icon',
      url: 'https://upload.example',
      iconMode: 'upload',
      iconStorageKey: previousKey,
    })
    const form = new FormData()
    form.set('title', 'Still Uploaded')
    form.set('url', favorite.url)
    form.set('iconMode', 'upload')
    form.set('automaticIconAction', 'refresh')
    form.set('enabled', '1')
    form.set(
      'iconFile',
      new File(['not an image'], 'spoofed.png', { type: 'image/png' }),
    )

    const response = await adminRequest(`/admin/favorites/${favorite.id}`, {
      body: form,
      method: 'POST',
    })
    const body = await response.text()

    expect(response.status).toBe(422)
    expect(body).toContain('does not appear to be a valid PNG, JPEG, or WebP')
    await expect(getFavorite(env.DB, favorite.id)).resolves.toMatchObject({
      title: 'Uploaded Icon',
      iconStorageKey: previousKey,
    })
    await expect(env.ICONS.get(previousKey)).resolves.not.toBeNull()
    await expect(env.ICONS.list()).resolves.toMatchObject({
      objects: [{ key: previousKey }],
    })
  })

  it('cleans up a new upload and preserves the previous one after a D1 validation failure', async () => {
    await createFavorite(env.DB, {
      title: 'Taken URL',
      url: 'https://taken.example',
      iconMode: 'fallback',
    })
    const previousKey = await storeCustomIcon(env.ICONS, pngFile('old.png'))
    const favorite = await createFavorite(env.DB, {
      title: 'Uploaded Icon',
      url: 'https://upload.example',
      iconMode: 'upload',
      iconStorageKey: previousKey,
    })
    const form = new FormData()
    form.set('title', favorite.title)
    form.set('url', 'https://taken.example')
    form.set('iconMode', 'upload')
    form.set('automaticIconAction', 'refresh')
    form.set('enabled', '1')
    form.set('iconFile', pngFile('replacement.png'))

    const response = await adminRequest(`/admin/favorites/${favorite.id}`, {
      body: form,
      method: 'POST',
    })

    expect(response.status).toBe(422)
    expect(await response.text()).toContain(
      'This web address is already in Favorites.',
    )
    await expect(getFavorite(env.DB, favorite.id)).resolves.toMatchObject({
      url: 'https://upload.example/',
      iconStorageKey: previousKey,
    })
    await expect(env.ICONS.list()).resolves.toMatchObject({
      objects: [{ key: previousKey }],
    })
  })

  it('returns field errors without changing the stored favorite', async () => {
    const favorite = await createFavorite(env.DB, {
      title: 'Original',
      url: 'https://original.example',
      iconMode: 'fallback',
    })
    const response = await adminRequest(`/admin/favorites/${favorite.id}`, {
      body: editValues({ title: '', url: 'bad url' }),
      method: 'POST',
    })
    const body = await response.text()

    expect(response.status).toBe(422)
    expect(body).toContain('Enter a display name.')
    expect(body).toContain(
      'Enter a complete web address beginning with http:// or https://.',
    )
    expect(body).toContain('value="bad url"')
    await expect(getFavorite(env.DB, favorite.id)).resolves.toMatchObject({
      title: 'Original',
      url: 'https://original.example/',
    })
  })

  it('returns not found for missing favorites and rejects unauthorized updates', async () => {
    const missingGet = await adminRequest('/admin/favorites/missing/edit')
    const missingPost = await adminRequest('/admin/favorites/missing', {
      body: editValues(),
      method: 'POST',
    })
    const unauthorized = await workerExports.default.fetch(
      new Request(`${origin}/admin/favorites/missing`, {
        body: editValues(),
        headers: { Origin: origin },
        method: 'POST',
      }),
    )

    expect(missingGet.status).toBe(404)
    expect(missingPost.status).toBe(404)
    expect(unauthorized.status).toBe(401)
    await expect(listFavorites(env.DB)).resolves.toEqual([])
  })
})
