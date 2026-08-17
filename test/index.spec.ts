import { env, exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { createFavorite } from '../src/services/favorites'

describe('WebVista Worker', () => {
  it('serves the server-rendered portal', async () => {
    const response = await workerExports.default.fetch('https://webvista.test/')
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(body).toContain('<title>WebVista</title>')
    expect(body).toContain('action="https://www.google.com/search"')
    expect(body).toContain('name="q"')
    expect(body).toContain('method="get"')
    expect(body).toContain('type="submit"')
    expect(body).toContain('placeholder="Search Google..."')
    expect(body).toContain('data-search-prompt')
    expect(body).toContain('brand-eyebrow')
    expect(body).toContain('text-base-content/75')
    expect(body).not.toMatch(/text-base-content\/(45|50|55|60)/)
    expect(body).toContain('href="/assets/app.css"')
    expect(body).not.toContain('<script')
    expect(body).not.toContain('hx-')
    expect(body).toContain('Your favorites will appear here.')
    expect(body).not.toContain('/admin')
  })

  it('renders only enabled favorites in stored order as same-tab links', async () => {
    const first = await createFavorite(env.DB, {
      title: 'Example Search',
      url: 'https://example.com/search',
      iconMode: 'fallback',
    })
    const disabled = await createFavorite(env.DB, {
      title: 'Hidden Site',
      url: 'https://hidden.example',
      iconMode: 'fallback',
      enabled: false,
    })
    const second = await createFavorite(env.DB, {
      title: 'News & Weather',
      url: 'https://news.example',
      iconMode: 'fallback',
    })

    const response = await workerExports.default.fetch('https://webvista.test/')
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('data-favorites-grid')
    expect(body).toContain(`data-favorite-id="${first.id}"`)
    expect(body).toContain(`href="${first.url}"`)
    expect(body).toContain('ES')
    expect(body).toContain(`data-favorite-id="${second.id}"`)
    expect(body).toContain('News &amp; Weather')
    expect(body).not.toContain(disabled.id)
    expect(body).not.toContain('target="_blank"')
    expect(body.indexOf(first.id)).toBeLessThan(body.indexOf(second.id))
  })

  it('redirects unauthenticated admin requests to login', async () => {
    const response = await workerExports.default.fetch(
      new Request('https://webvista.test/admin', { redirect: 'manual' }),
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin/login')
  })

  it('renders a private admin login form', async () => {
    const response = await workerExports.default.fetch('https://webvista.test/admin/login')
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toContain('action="/admin/login"')
    expect(body).toContain('name="password"')
    expect(body).toContain('autocomplete="current-password"')
    expect(body).toContain('content="noindex,nofollow"')
  })

  it('does not expose unknown admin routes', async () => {
    const response = await workerExports.default.fetch(
      new Request('https://webvista.test/admin/favorites/new', {
        redirect: 'manual',
      }),
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin/login')
  })
})
