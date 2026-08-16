import { env, exports as workerExports } from 'cloudflare:workers'
import { generateSignedCookie } from 'hono/cookie'
import { describe, expect, it } from 'vitest'
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  isSessionValueValid,
  passwordsMatch,
} from '../src/middleware/auth'

const origin = 'https://webvista.test'

function loginRequest(password: string, requestOrigin = origin): Request {
  return new Request(`${origin}/admin/login`, {
    body: new URLSearchParams({ password }),
    headers: { Origin: requestOrigin },
    method: 'POST',
    redirect: 'manual',
  })
}

async function login(): Promise<string> {
  const response = await workerExports.default.fetch(
    loginRequest(env.ADMIN_PASSWORD),
  )
  const setCookie = response.headers.get('set-cookie')

  expect(response.status).toBe(303)
  expect(response.headers.get('location')).toBe('/admin')
  expect(setCookie).not.toBeNull()

  return setCookie!.split(';', 1)[0]
}

describe('admin authentication', () => {
  it('compares passwords without accepting near matches or oversized input', async () => {
    await expect(passwordsMatch('correct', 'correct')).resolves.toBe(true)
    await expect(passwordsMatch('Correct', 'correct')).resolves.toBe(false)
    await expect(passwordsMatch('x'.repeat(1025), 'correct')).resolves.toBe(false)
  })

  it('rejects an incorrect password with a generic error and no cookie', async () => {
    const response = await workerExports.default.fetch(
      loginRequest('incorrect-password'),
    )
    const body = await response.text()

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(body).toContain('The password was not accepted.')
    expect(body).not.toContain('incorrect-password')
  })

  it('issues a secure signed session and grants access to admin', async () => {
    const response = await workerExports.default.fetch(
      loginRequest(env.ADMIN_PASSWORD),
    )
    const setCookie = response.headers.get('set-cookie') ?? ''
    const cookie = setCookie.split(';', 1)[0]

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin')
    expect(setCookie).toContain('__Host-webvista_session=')
    expect(setCookie).toContain(`Max-Age=${SESSION_TTL_SECONDS}`)
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Priority=High')
    expect(setCookie).toMatch(/Expires=/)

    const adminResponse = await workerExports.default.fetch(
      new Request(`${origin}/admin`, { headers: { Cookie: cookie } }),
    )
    const body = await adminResponse.text()

    expect(adminResponse.status).toBe(200)
    expect(adminResponse.headers.get('cache-control')).toBe('no-store')
    expect(body).toContain('<title>Admin · WebVista</title>')
    expect(body).toContain('action="/admin/logout"')
    expect(body).toContain('WebVista Admin')
    expect(body).toContain('Favorites')
  })

  it('redirects an already authenticated login page to admin', async () => {
    const cookie = await login()
    const response = await workerExports.default.fetch(
      new Request(`${origin}/admin/login`, {
        headers: { Cookie: cookie },
        redirect: 'manual',
      }),
    )

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin')
  })

  it('rejects tampered and expired sessions', async () => {
    const cookie = await login()
    const tamperedCookie = `${cookie.slice(0, -1)}x`
    const expiredValue = `1:${Math.floor(Date.now() / 1000) - 60}`
    const expiredCookie = await generateSignedCookie(
      SESSION_COOKIE_NAME,
      expiredValue,
      env.ADMIN_SESSION_SECRET,
      { prefix: 'host' },
    )

    expect(isSessionValueValid(expiredValue)).toBe(false)

    for (const rejectedCookie of [tamperedCookie, expiredCookie]) {
      const response = await workerExports.default.fetch(
        new Request(`${origin}/admin`, {
          headers: { Cookie: rejectedCookie.split(';', 1)[0] },
          redirect: 'manual',
        }),
      )

      expect(response.status).toBe(303)
      expect(response.headers.get('location')).toBe('/admin/login')
    }
  })

  it('clears the browser session on logout', async () => {
    const cookie = await login()
    const response = await workerExports.default.fetch(
      new Request(`${origin}/admin/logout`, {
        headers: { Cookie: cookie, Origin: origin },
        method: 'POST',
        redirect: 'manual',
      }),
    )
    const setCookie = response.headers.get('set-cookie') ?? ''

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin/login')
    expect(setCookie).toContain('__Host-webvista_session=')
    expect(setCookie).toContain('Max-Age=0')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Strict')
  })

  it('rejects unauthorized and cross-origin admin writes', async () => {
    const unauthorized = await workerExports.default.fetch(
      new Request(`${origin}/admin/favorites/reorder`, {
        headers: { Origin: origin },
        method: 'POST',
      }),
    )
    expect(unauthorized.status).toBe(401)

    const cookie = await login()
    const crossOrigin = await workerExports.default.fetch(
      new Request(`${origin}/admin/favorites/reorder`, {
        headers: { Cookie: cookie, Origin: 'https://attacker.example' },
        method: 'POST',
      }),
    )
    expect(crossOrigin.status).toBe(403)
  })

  it('requires same-origin login submissions', async () => {
    const response = await workerExports.default.fetch(
      loginRequest(env.ADMIN_PASSWORD, 'https://attacker.example'),
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('returns not found for unknown authenticated admin routes', async () => {
    const cookie = await login()
    const response = await workerExports.default.fetch(
      new Request(`${origin}/admin/not-a-route`, {
        headers: { Cookie: cookie },
      }),
    )

    expect(response.status).toBe(404)
  })
})
