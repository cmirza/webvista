import { describe, expect, it, vi } from 'vitest'
import {
  discoverSiteMetadata,
  isSafePublicUrl,
} from '../src/services/icons'

type ResponseFactory = () => Response

const htmlResponse = (body: string, init: ResponseInit = {}): Response =>
  new Response(body, {
    ...init,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...init.headers,
    },
  })

const imageResponse = (type = 'image/png'): Response =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: {
      'Content-Length': '3',
      'Content-Type': type,
    },
  })

const createFetcher = (routes: Record<string, ResponseFactory>) =>
  vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString()
    const factory = routes[url]

    if (!factory) {
      return new Response('Not found', { status: 404 })
    }

    return factory()
  })

describe('icon discovery', () => {
  it('prefers the largest Apple touch icon over manifest and favicon icons', async () => {
    const fetcher = createFetcher({
      'https://example.com/': () =>
        htmlResponse(`
          <html>
            <head>
              <title> Example Site </title>
              <link rel="icon" href="/favicon-64.png" sizes="64x64" />
              <link rel="apple-touch-icon" href="/apple-120.png" sizes="120x120" />
              <link rel="apple-touch-icon" href="/apple-180.png" sizes="180x180" />
              <link rel="manifest" href="/app.webmanifest" />
            </head>
          </html>
        `),
      'https://example.com/app.webmanifest': () =>
        new Response(
          JSON.stringify({
            icons: [{ src: '/manifest-512.png', sizes: '512x512', type: 'image/png' }],
          }),
          { headers: { 'Content-Type': 'application/manifest+json' } },
        ),
      'https://example.com/apple-180.png': () => imageResponse(),
    })

    const result = await discoverSiteMetadata('https://example.com', { fetcher })

    expect(result).toMatchObject({
      pageUrl: 'https://example.com/',
      title: 'Example Site',
      failure: null,
      icon: {
        url: 'https://example.com/apple-180.png',
        source: 'apple-touch-icon',
        width: 180,
        height: 180,
      },
    })
  })

  it('resolves manifest icons against the manifest URL and chooses the largest', async () => {
    const fetcher = createFetcher({
      'https://example.com/start': () =>
        htmlResponse('<link rel="manifest" href="/assets/site.webmanifest">'),
      'https://example.com/assets/site.webmanifest': () =>
        new Response(
          JSON.stringify({
            icons: [
              { src: 'icons/small.png', sizes: '48x48' },
              { src: 'icons/large.png', sizes: '256x256', type: 'image/png' },
            ],
          }),
          { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
        ),
      'https://example.com/assets/icons/large.png': () => imageResponse(),
    })

    const result = await discoverSiteMetadata('https://example.com/start', {
      fetcher,
    })

    expect(result.icon).toEqual({
      url: 'https://example.com/assets/icons/large.png',
      source: 'manifest',
      width: 256,
      height: 256,
      type: 'image/png',
    })
  })

  it('follows validated page redirects and chooses the largest favicon', async () => {
    const fetcher = createFetcher({
      'https://example.com/': () =>
        new Response(null, {
          status: 302,
          headers: { Location: '/home/' },
        }),
      'https://example.com/home/': () =>
        htmlResponse(`
          <title>Redirected</title>
          <link rel="icon" href="small.png" sizes="16x16" />
          <link rel="shortcut icon" href="large.png" sizes="128x128" />
        `),
      'https://example.com/home/large.png': () => imageResponse('image/webp'),
    })

    const result = await discoverSiteMetadata('https://example.com', { fetcher })

    expect(result.pageUrl).toBe('https://example.com/home/')
    expect(result.title).toBe('Redirected')
    expect(result.icon).toMatchObject({
      url: 'https://example.com/home/large.png',
      source: 'favicon',
      width: 128,
      height: 128,
    })
  })

  it('falls through broken preferred icons and malformed manifests', async () => {
    const fetcher = createFetcher({
      'https://example.com/': () =>
        htmlResponse(`
          <link rel="apple-touch-icon" href="/broken.png" sizes="180x180" />
          <link rel="manifest" href="/broken.webmanifest" />
          <link rel="icon" href="/working.png" sizes="96x96" />
        `),
      'https://example.com/broken.webmanifest': () =>
        new Response('{not-json', {
          headers: { 'Content-Type': 'application/manifest+json' },
        }),
      'https://example.com/broken.png': () =>
        new Response(new Uint8Array([1]), {
          headers: {
            'Content-Length': '9999999',
            'Content-Type': 'image/png',
          },
        }),
      'https://example.com/working.png': () => imageResponse(),
    })

    const result = await discoverSiteMetadata('https://example.com', { fetcher })

    expect(result.icon).toMatchObject({
      url: 'https://example.com/working.png',
      source: 'favicon',
    })
    expect(result.failure).toBeNull()
  })

  it('rejects local, private, credentialed, and unusual-port targets', () => {
    expect(isSafePublicUrl('http://localhost')).toBe(false)
    expect(isSafePublicUrl('http://router')).toBe(false)
    expect(isSafePublicUrl('http://router.home.arpa')).toBe(false)
    expect(isSafePublicUrl('http://127.0.0.1')).toBe(false)
    expect(isSafePublicUrl('http://2130706433')).toBe(false)
    expect(isSafePublicUrl('http://0x7f000001')).toBe(false)
    expect(isSafePublicUrl('http://169.254.169.254/latest/meta-data')).toBe(false)
    expect(isSafePublicUrl('http://192.168.1.1')).toBe(false)
    expect(isSafePublicUrl('http://[::1]')).toBe(false)
    expect(isSafePublicUrl('http://[::ffff:127.0.0.1]')).toBe(false)
    expect(isSafePublicUrl('https://user:secret@example.com')).toBe(false)
    expect(isSafePublicUrl('https://example.com:8443')).toBe(false)
    expect(isSafePublicUrl('https://example.com')).toBe(true)
    expect(isSafePublicUrl('https://8.8.8.8')).toBe(true)
  })

  it('does not follow redirects to unsafe network targets', async () => {
    const fetcher = createFetcher({
      'https://example.com/': () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'http://127.0.0.1/private' },
        }),
    })

    const result = await discoverSiteMetadata('https://example.com', { fetcher })

    expect(result).toMatchObject({ icon: null, failure: 'unsafe-url' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('stops redirect chains at the configured limit', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? new URL(input.url) : new URL(input)
      const redirectNumber = Number(url.searchParams.get('redirect') ?? '0')

      return new Response(null, {
        status: 302,
        headers: {
          Location: `https://example.com/?redirect=${redirectNumber + 1}`,
        },
      })
    })

    const result = await discoverSiteMetadata('https://example.com', {
      fetcher,
      maxRedirects: 2,
    })

    expect(result.failure).toBe('too-many-redirects')
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('rejects invalid content types and oversized response bodies gracefully', async () => {
    const wrongType = await discoverSiteMetadata('https://example.com', {
      fetcher: createFetcher({
        'https://example.com/': () =>
          new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
      }),
    })
    const tooLarge = await discoverSiteMetadata('https://large.example', {
      fetcher: createFetcher({
        'https://large.example/': () =>
          htmlResponse('x'.repeat(101)),
      }),
      htmlBytes: 100,
    })

    expect(wrongType.failure).toBe('invalid-content-type')
    expect(tooLarge.failure).toBe('response-too-large')
  })

  it('times out stalled metadata requests without throwing', async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )

    const result = await discoverSiteMetadata('https://example.com', {
      fetcher,
      timeoutMs: 5,
    })

    expect(result.failure).toBe('fetch-failed')
    expect(result.icon).toBeNull()
  })
})
