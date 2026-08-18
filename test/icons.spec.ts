import { describe, expect, it, vi } from 'vitest'
import {
  discoverLinkMetadata,
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

describe('link metadata discovery', () => {
  it('uses Open Graph metadata and resolves relative images safely', async () => {
    const fetcher = createFetcher({
      'https://news.example/story': () =>
        htmlResponse(`
          <title>Fallback title</title>
          <meta name="description" content="Fallback description" />
          <meta property="og:title" content="Story headline" />
          <meta property="og:description" content="Story summary" />
          <meta property="og:site_name" content="Example News" />
          <meta property="og:image" content="/images/story.jpg" />
        `),
    })

    await expect(
      discoverLinkMetadata('https://news.example/story', { fetcher }),
    ).resolves.toEqual({
      pageUrl: 'https://news.example/story',
      title: 'Story headline',
      description: 'Story summary',
      imageUrl: 'https://news.example/images/story.jpg',
      sourceName: 'Example News',
      failure: null,
    })
  })

  it('falls back to standard metadata and rejects unsafe image addresses', async () => {
    const fetcher = createFetcher({
      'https://video.example/watch': () =>
        htmlResponse(`
          <title>Video title</title>
          <meta name="description" content="Video description" />
          <meta property="og:image" content="http://127.0.0.1/private.jpg" />
        `),
    })

    const result = await discoverLinkMetadata('https://video.example/watch', {
      fetcher,
    })

    expect(result).toMatchObject({
      title: 'Video title',
      description: 'Video description',
      imageUrl: null,
      sourceName: null,
      failure: null,
    })
  })

  it('reads preview metadata from a bounded prefix of an oversized CNBC page', async () => {
    const article =
      'https://www.cnbc.com/2026/08/15/anthropic-revenue-jumps-to-over-11point5-billion-in-q2-report.html'
    const head = `
      <meta property="og:title" content="Anthropic revenue reportedly jumps" />
      <meta property="og:description" content="Claude maker growth accelerated." />
      <meta property="og:site_name" content="CNBC" />
      <meta property="og:image" content="https://image.cnbcfm.com/story.jpg?w=1920&amp;h=1080" />
    `
    const oversizedPage = `${head}${'x'.repeat(300 * 1024)}`
    const fetcher = createFetcher({
      [article]: () =>
        htmlResponse(oversizedPage, {
          headers: { 'Content-Length': String(oversizedPage.length) },
        }),
    })

    await expect(discoverLinkMetadata(article, { fetcher })).resolves.toEqual({
      pageUrl: article,
      title: 'Anthropic revenue reportedly jumps',
      description: 'Claude maker growth accelerated.',
      imageUrl: 'https://image.cnbcfm.com/story.jpg?w=1920&h=1080',
      sourceName: 'CNBC',
      failure: null,
    })
  })

  it('reads preview metadata after a large publisher preload block', async () => {
    const article =
      'https://www.cnn.com/2026/08/16/sport/oj-simpson-1990s-decade-in-sports'
    const lateHead = `
      <head>
        ${' '.repeat(320 * 1024)}
        <title>Fallback CNN title</title>
        <meta property="og:title" content="OJ Simpson's infamous chase captured a changing era of US sports" />
        <meta property="og:description" content="The Bronco chase became one of the defining sports stories of the decade." />
        <meta property="og:site_name" content="CNN" />
        <meta property="og:image" content="https://media.cnn.com/api/v1/images/story.jpg" />
      </head>
      ${'x'.repeat(300 * 1024)}
    `
    const fetcher = createFetcher({
      [article]: () =>
        htmlResponse(lateHead, {
          headers: { 'Content-Length': String(lateHead.length) },
        }),
    })

    await expect(discoverLinkMetadata(article, { fetcher })).resolves.toEqual({
      pageUrl: article,
      title: "OJ Simpson's infamous chase captured a changing era of US sports",
      description:
        'The Bronco chase became one of the defining sports stories of the decade.',
      imageUrl: 'https://media.cnn.com/api/v1/images/story.jpg',
      sourceName: 'CNN',
      failure: null,
    })
  })

  it('does not fetch an unsafe metadata target', async () => {
    const fetcher = vi.fn()
    const result = await discoverLinkMetadata('http://localhost/private', {
      fetcher,
    })

    expect(result.failure).toBe('unsafe-url')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('uses YouTube oEmbed without downloading the oversized watch page', async () => {
    const fetcher = createFetcher({
      'https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DfuRPZ9sSVSo&format=json': () =>
        new Response(
          JSON.stringify({
            title: 'Demolition day nears',
            author_name: 'KATU News',
            provider_name: 'YouTube',
            thumbnail_url: 'https://i.ytimg.com/vi/fuRPZ9sSVSo/hqdefault.jpg',
          }),
          { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
        ),
    })

    const result = await discoverLinkMetadata(
      'https://www.youtube.com/watch?v=fuRPZ9sSVSo',
      { fetcher },
    )

    expect(result).toEqual({
      pageUrl: 'https://www.youtube.com/watch?v=fuRPZ9sSVSo',
      title: 'Demolition day nears',
      description: 'By KATU News',
      imageUrl: 'https://i.ytimg.com/vi/fuRPZ9sSVSo/hqdefault.jpg',
      sourceName: 'YouTube',
      failure: null,
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('uses the NYT first-party oEmbed endpoint when article HTML is protected', async () => {
    const article =
      'https://www.nytimes.com/2026/08/16/us/politics/military-ai-china-anthropic.html'
    const endpoint =
      'https://www.nytimes.com/svc/oembed/json/?url=https%3A%2F%2Fwww.nytimes.com%2F2026%2F08%2F16%2Fus%2Fpolitics%2Fmilitary-ai-china-anthropic.html'
    const fetcher = createFetcher({
      [endpoint]: () =>
        new Response(
          JSON.stringify({
            title: 'The U.S. Military Wants A.I. Dominance',
            summary: 'The administration is weighing the security implications of A.I.',
            provider_name: 'The New York Times',
            thumbnail_url: 'https://static01.nyt.com/images/story.jpg',
          }),
          { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
        ),
    })

    await expect(discoverLinkMetadata(article, { fetcher })).resolves.toEqual({
      pageUrl: article,
      title: 'The U.S. Military Wants A.I. Dominance',
      description: 'The administration is weighing the security implications of A.I.',
      imageUrl: 'https://static01.nyt.com/images/story.jpg',
      sourceName: 'The New York Times',
      failure: null,
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('uses Bloomberg first-party RSS when article HTML is blocked', async () => {
    const article =
      'https://www.bloomberg.com/news/articles/2026-08-16/stripe-nears-deal-to-buy-ai-firm-openrouter-for-over-7-billion'
    const fetcher = createFetcher({
      [article]: () => htmlResponse('Are you a robot?', { status: 403 }),
      'https://www.bloomberg.com/feeds/technology/news.rss': () =>
        new Response(
          `<rss><channel><item>
            <title><![CDATA[Stripe Clinches Over $7 Billion Deal to Buy AI Firm OpenRouter]]></title>
            <description><![CDATA[Stripe has finalized an agreement to acquire OpenRouter.]]></description>
            <link>${article}</link>
          </item></channel></rss>`,
          { headers: { 'Content-Type': 'text/xml; charset=utf-8' } },
        ),
    })

    await expect(discoverLinkMetadata(article, { fetcher })).resolves.toEqual({
      pageUrl: article,
      title: 'Stripe Clinches Over $7 Billion Deal to Buy AI Firm OpenRouter',
      description: 'Stripe has finalized an agreement to acquire OpenRouter.',
      imageUrl: null,
      sourceName: 'Bloomberg',
      failure: null,
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('generates an editable Reuters preview when every retrieval layer is blocked', async () => {
    const article =
      'https://www.reuters.com/business/anthropic-ipo-valuation-hinges-190-200-billion-2028-revenue-forecast-sources-say-2026-08-15/'
    const ampArticle = `${article.replace(/\/$/, '')}/amp/`
    const fetcher = createFetcher({
      [article]: () => htmlResponse('Protected by DataDome', { status: 401 }),
      [ampArticle]: () => htmlResponse('Protected by DataDome', { status: 401 }),
    })

    await expect(discoverLinkMetadata(article, { fetcher })).resolves.toEqual({
      pageUrl: article,
      title:
        'Anthropic IPO valuation hinges 190 200 billion 2028 revenue forecast sources say',
      description: null,
      imageUrl: null,
      sourceName: 'Reuters',
      failure: 'fetch-failed',
      fallback: 'url',
    })
  })

  it('retries a blocked publisher page through its first-party AMP page', async () => {
    const article =
      'https://www.koin.com/news/portland/centennial-mills-demolition/'
    const fetcher = createFetcher({
      [article]: () => htmlResponse('Access denied', { status: 403 }),
      [`${article}amp/`]: () =>
        htmlResponse(`
          <meta property="og:title" content="&#8216;Sirens will sound&#8217; Monday" />
          <meta property="og:description" content="A demolition update." />
          <meta property="og:site_name" content="KOIN.com" />
          <meta property="og:image" content="/story.jpg" />
        `),
    })

    const result = await discoverLinkMetadata(article, { fetcher })

    expect(result).toEqual({
      pageUrl: `${article}amp/`,
      title: '‘Sirens will sound’ Monday',
      description: 'A demolition update.',
      imageUrl: 'https://www.koin.com/story.jpg',
      sourceName: 'KOIN.com',
      failure: null,
      alternate: 'amp',
    })
  })

  it('verifies and selects a same-origin declared AMP address', async () => {
    const article = 'https://publisher.example/story'
    const ampArticle = 'https://publisher.example/story/amp/'
    const fetcher = createFetcher({
      [article]: () =>
        htmlResponse(`
          <link rel="amphtml" href="${ampArticle}" />
          <meta property="og:title" content="Original metadata" />
          <meta property="og:site_name" content="Publisher" />
        `),
      [ampArticle]: () => htmlResponse('<title>Readable article</title>'),
    })

    const result = await discoverLinkMetadata(article, { fetcher })

    expect(result).toMatchObject({
      pageUrl: ampArticle,
      title: 'Original metadata',
      sourceName: 'Publisher',
      alternate: 'amp',
      failure: null,
    })
  })

  it('ignores cross-origin or unavailable declared AMP addresses', async () => {
    const article = 'https://publisher.example/story'
    const fetcher = createFetcher({
      [article]: () =>
        htmlResponse(`
          <link rel="amphtml" href="https://different.example/story/amp/" />
          <meta property="og:title" content="Original article" />
        `),
    })

    const result = await discoverLinkMetadata(article, { fetcher })

    expect(result).toMatchObject({
      pageUrl: article,
      title: 'Original article',
      failure: null,
    })
    expect(result.alternate).toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('finds an Akamai-blocked KGW article in KGW\'s bounded RSS feed', async () => {
    const article =
      'https://www.kgw.com/article/news/local/story/283-40d63314-13e5-4cf6-80c0-0ed7776372e9'
    const fetcher = createFetcher({
      [article]: () => htmlResponse('Access denied', { status: 403 }),
      [`${article}/amp/`]: () => htmlResponse('Access denied', { status: 403 }),
      'https://www.kgw.com/feeds/syndication/rss/news': () =>
        new Response(
          `<rss><channel><item>
            <title>Sirens will sound before demolition</title>
            <link>${article}</link>
            <description>The city shared details &amp; a countdown.</description>
            <enclosure url="https://media.tegna-media.com/story.jpg" type="image/jpeg" />
          </item></channel></rss>`,
          { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
        ),
    })

    const result = await discoverLinkMetadata(article, { fetcher })

    expect(result).toEqual({
      pageUrl: article,
      title: 'Sirens will sound before demolition',
      description: 'The city shared details & a countdown.',
      imageUrl: 'https://media.tegna-media.com/story.jpg',
      sourceName: 'KGW',
      failure: null,
    })
  })
})
