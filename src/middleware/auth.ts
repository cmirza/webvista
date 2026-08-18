import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import {
  deleteCookie,
  getSignedCookie,
  setSignedCookie,
} from 'hono/cookie'

export const SESSION_COOKIE_NAME = 'webvista_session'
export const SESSION_TTL_SECONDS = 8 * 60 * 60

const MAX_PASSWORD_LENGTH = 1024
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const encoder = new TextEncoder()

type AppContext = Context<{ Bindings: CloudflareBindings }>

export function isAuthConfigured(bindings: CloudflareBindings): boolean {
  return Boolean(bindings.ADMIN_PASSWORD && bindings.ADMIN_SESSION_SECRET)
}

export async function passwordsMatch(
  candidate: string,
  expected: string,
): Promise<boolean> {
  if (candidate.length > MAX_PASSWORD_LENGTH) {
    return false
  }

  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  const candidateBytes = new Uint8Array(candidateHash)
  const expectedBytes = new Uint8Array(expectedHash)
  let difference = 0

  for (let index = 0; index < candidateBytes.length; index += 1) {
    difference |= candidateBytes[index] ^ expectedBytes[index]
  }

  return difference === 0
}

function createSessionValue(now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS
  return `1:${expiresAt}`
}

export function isSessionValueValid(value: string, now = Date.now()): boolean {
  const match = /^1:(\d{10})$/.exec(value)
  if (!match) {
    return false
  }

  const expiresAt = Number(match[1])
  return Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(now / 1000)
}

export async function hasAdminSession(context: AppContext): Promise<boolean> {
  if (!isAuthConfigured(context.env)) {
    return false
  }

  const value = await getSignedCookie(
    context,
    context.env.ADMIN_SESSION_SECRET,
    SESSION_COOKIE_NAME,
    'host',
  )

  return typeof value === 'string' && isSessionValueValid(value)
}

export async function startAdminSession(context: AppContext): Promise<void> {
  const expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)

  await setSignedCookie(
    context,
    SESSION_COOKIE_NAME,
    createSessionValue(),
    context.env.ADMIN_SESSION_SECRET,
    {
      expires,
      httpOnly: true,
      maxAge: SESSION_TTL_SECONDS,
      prefix: 'host',
      priority: 'high',
      // Bookmarklets open WebVista as a top-level cross-site GET. Lax keeps
      // that safe navigation signed in while same-origin checks still protect
      // every state-changing admin request.
      sameSite: 'Lax',
    },
  )
}

export function endAdminSession(context: AppContext): void {
  deleteCookie(context, SESSION_COOKIE_NAME, {
    httpOnly: true,
    prefix: 'host',
    priority: 'high',
    sameSite: 'Lax',
  })
}

export const requireAdmin = createMiddleware<{
  Bindings: CloudflareBindings
}>(async (context, next) => {
  context.header('Cache-Control', 'no-store')

  if (await hasAdminSession(context)) {
    await next()
    return
  }

  if (context.req.method === 'GET' || context.req.method === 'HEAD') {
    const requested = new URL(context.req.url)
    const destination = `${requested.pathname}${requested.search}`
    return context.redirect(
      destination === '/admin'
        ? '/admin/login'
        : `/admin/login?next=${encodeURIComponent(destination)}`,
      303,
    )
  }

  return context.text('Unauthorized', 401)
})

export const requireSameOriginForWrites = createMiddleware<{
  Bindings: CloudflareBindings
}>(async (context, next) => {
  if (SAFE_METHODS.has(context.req.method)) {
    await next()
    return
  }

  const origin = context.req.header('Origin')
  let expectedOrigin: string

  try {
    expectedOrigin = new URL(context.req.url).origin
  } catch {
    return context.text('Forbidden', 403)
  }

  if (origin !== expectedOrigin) {
    return context.text('Forbidden', 403)
  }

  await next()
})
