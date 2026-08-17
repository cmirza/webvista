import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import app from '../src/app'
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

const bindings = (
  overrides: Partial<CloudflareBindings> = {},
): CloudflareBindings => ({
  ADMIN_PASSWORD: env.ADMIN_PASSWORD,
  ADMIN_SESSION_SECRET: env.ADMIN_SESSION_SECRET,
  DB: env.DB,
  ICONS: env.ICONS,
  ...overrides,
})

async function adminCookie(testBindings: CloudflareBindings): Promise<string> {
  const response = await app.fetch(
    new Request(`${origin}/admin/login`, {
      body: new URLSearchParams({ password: testBindings.ADMIN_PASSWORD }),
      headers: { Origin: origin },
      method: 'POST',
      redirect: 'manual',
    }),
    testBindings,
  )

  expect(response.status).toBe(303)
  return response.headers.get('set-cookie')!.split(';', 1)[0]
}

async function adminRequest(
  testBindings: CloudflareBindings,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Cookie', await adminCookie(testBindings))

  if (init.method && init.method !== 'GET') {
    headers.set('Origin', origin)
  }

  return app.fetch(
    new Request(`${origin}${path}`, {
      ...init,
      headers,
      redirect: 'manual',
    }),
    testBindings,
  )
}

const throwingBucket = (operation: 'put' | 'delete'): R2Bucket =>
  ({
    [operation]: async () => {
      throw new Error(`Simulated R2 ${operation} failure`)
    },
  }) as unknown as R2Bucket

describe('storage failure states', () => {
  it('renders safe service-unavailable responses when D1 cannot be read', async () => {
    const brokenDb = {
      prepare: () => {
        throw new Error('Sensitive database detail')
      },
    } as unknown as D1Database
    const testBindings = bindings({ DB: brokenDb })
    const admin = await adminRequest(testBindings, '/admin', {
      headers: { 'HX-Request': 'true' },
    })
    const adminBody = await admin.text()
    const portal = await app.fetch(new Request(`${origin}/`), testBindings)
    const portalBody = await portal.text()

    expect(admin.status).toBe(503)
    expect(admin.headers.get('cache-control')).toBe('no-store')
    expect(adminBody).toContain('data-service-error')
    expect(adminBody).toContain('check the saved state before trying again')
    expect(adminBody).not.toContain('<!doctype html>')
    expect(adminBody).not.toContain('Sensitive database detail')
    expect(portal.status).toBe(503)
    expect(portalBody).toContain('Favorites could not be loaded')
    expect(portalBody).not.toContain('Sensitive database detail')
  })

  it('preserves form values and D1 state when an R2 upload fails', async () => {
    const testBindings = bindings({ ICONS: throwingBucket('put') })
    const form = new FormData()
    form.set('title', 'R2 Failure Site')
    form.set('url', 'https://r2-failure.example')
    form.set('iconMode', 'upload')
    form.set('iconFile', new File([pngBytes], 'icon.png', { type: 'image/png' }))

    const response = await adminRequest(testBindings, '/admin/favorites', {
      body: form,
      method: 'POST',
    })
    const body = await response.text()

    expect(response.status).toBe(422)
    expect(body).toContain('The custom icon could not be stored. Try again.')
    expect(body).toContain('value="R2 Failure Site"')
    expect(body).toContain('value="https://r2-failure.example"')
    await expect(listFavorites(env.DB)).resolves.toEqual([])
  })

  it('reports a successful edit when obsolete R2 cleanup fails', async () => {
    const oldKey = await storeCustomIcon(
      env.ICONS,
      new File([pngBytes], 'old.png', { type: 'image/png' }),
    )
    const favorite = await createFavorite(env.DB, {
      title: 'Uploaded Site',
      url: 'https://uploaded.example',
      iconMode: 'upload',
      iconStorageKey: oldKey,
    })
    const response = await adminRequest(
      bindings({ ICONS: throwingBucket('delete') }),
      `/admin/favorites/${favorite.id}`,
      {
        body: new URLSearchParams({
          title: favorite.title,
          url: favorite.url,
          iconMode: 'fallback',
          automaticIconAction: 'refresh',
          enabled: '1',
          presentation: 'dashboard',
        }),
        headers: { 'HX-Request': 'true' },
        method: 'POST',
      },
    )
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('<strong>Uploaded Site</strong> was updated.')
    expect(body).toContain('could not be cleaned up automatically')
    expect(body).not.toContain('data-auto-dismiss')
    await expect(getFavorite(env.DB, favorite.id)).resolves.toMatchObject({
      iconMode: 'fallback',
      iconStorageKey: null,
    })
    await expect(env.ICONS.get(oldKey)).resolves.not.toBeNull()
  })

  it('reports a successful deletion when R2 cleanup fails', async () => {
    const oldKey = await storeCustomIcon(
      env.ICONS,
      new File([pngBytes], 'old.png', { type: 'image/png' }),
    )
    const favorite = await createFavorite(env.DB, {
      title: 'Delete with R2 Failure',
      url: 'https://delete-r2.example',
      iconMode: 'upload',
      iconStorageKey: oldKey,
    })
    const response = await adminRequest(
      bindings({ ICONS: throwingBucket('delete') }),
      `/admin/favorites/${favorite.id}?confirmed=yes&presentation=dashboard`,
      {
        headers: { 'HX-Request': 'true' },
        method: 'DELETE',
      },
    )
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Delete with R2 Failure</strong> was removed.')
    expect(body).toContain('could not be cleaned up automatically')
    await expect(getFavorite(env.DB, favorite.id)).resolves.toBeNull()
    await expect(env.ICONS.get(oldKey)).resolves.not.toBeNull()
  })

  it('cleans up a new upload when the D1 insert fails', async () => {
    const failingDb = {
      prepare: (query: string) => {
        if (/INSERT\s+INTO\s+favorites/i.test(query)) {
          return {
            bind: () => ({
              first: async () => {
                throw new Error('Simulated D1 insert failure')
              },
            }),
          }
        }

        return env.DB.prepare(query)
      },
    } as unknown as D1Database
    const form = new FormData()
    form.set('title', 'D1 Failure Site')
    form.set('url', 'https://d1-failure.example')
    form.set('iconMode', 'upload')
    form.set('iconFile', new File([pngBytes], 'icon.png', { type: 'image/png' }))

    const response = await adminRequest(
      bindings({ DB: failingDb }),
      '/admin/favorites',
      { body: form, method: 'POST' },
    )
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(body).toContain('check the saved state before trying again')
    expect(body).not.toContain('Simulated D1 insert failure')
    await expect(listFavorites(env.DB)).resolves.toEqual([])
    await expect(env.ICONS.list()).resolves.toMatchObject({ objects: [] })
  })
})
