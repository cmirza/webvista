import { exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('WebVista Worker', () => {
  it('serves the server-rendered portal', async () => {
    const response = await workerExports.default.fetch('https://webvista.test/')
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(body).toContain('<title>WebVista</title>')
    expect(body).toContain('action="https://www.google.com/search"')
    expect(body).toContain('name="q"')
    expect(body).toContain('href="/assets/app.css"')
    expect(body).toContain('src="/assets/htmx.min.js"')
    expect(body).not.toContain('/admin')
  })

  it('keeps the admin surface closed before authentication exists', async () => {
    const response = await workerExports.default.fetch(
      new Request('https://webvista.test/admin', { redirect: 'manual' }),
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin/login')
  })

  it('marks the temporary admin login boundary as unavailable and private', async () => {
    const response = await workerExports.default.fetch('https://webvista.test/admin/login')
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toContain('Administration is not available yet.')
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
