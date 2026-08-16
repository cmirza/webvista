export const ICON_DISCOVERY_LIMITS = {
  htmlBytes: 256 * 1024,
  manifestBytes: 64 * 1024,
  iconBytes: 2 * 1024 * 1024,
  redirects: 3,
  timeoutMs: 4_000,
  candidateProbes: 8,
} as const

export type IconSource = 'apple-touch-icon' | 'manifest' | 'favicon'

export type IconDiscoveryFailure =
  | 'fetch-failed'
  | 'invalid-content-type'
  | 'response-too-large'
  | 'too-many-redirects'
  | 'unsafe-url'

export interface IconCandidate {
  url: string
  source: IconSource
  width: number | null
  height: number | null
  type: string | null
}

export interface SiteMetadata {
  pageUrl: string
  title: string | null
  icon: IconCandidate | null
  failure: IconDiscoveryFailure | null
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

interface DiscoveryOptions {
  fetcher?: Fetcher
  htmlBytes?: number
  iconBytes?: number
  manifestBytes?: number
  maxCandidateProbes?: number
  maxRedirects?: number
  timeoutMs?: number
}

interface ParsedPage {
  title: string | null
  appleIcons: IconCandidate[]
  favicons: IconCandidate[]
  manifests: string[]
}

interface FetchResult {
  response: Response
  url: URL
}

class IconDiscoveryError extends Error {
  constructor(public readonly code: IconDiscoveryFailure) {
    super(code)
    this.name = 'IconDiscoveryError'
  }
}

const isIpv4Address = (hostname: string): boolean =>
  /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)

const isPublicIpv4Address = (hostname: string): boolean => {
  const octets = hostname.split('.').map(Number)

  if (octets.length !== 4 || octets.some((octet) => octet < 0 || octet > 255)) {
    return false
  }

  const [first, second] = octets

  return !(
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  )
}

const isPublicIpv6Address = (hostname: string): boolean => {
  const address = hostname.replace(/^\[|\]$/g, '').toLowerCase()

  if (
    address === '::' ||
    address === '::1' ||
    address.startsWith('::ffff:') ||
    address.startsWith('fc') ||
    address.startsWith('fd') ||
    /^fe[89ab]/.test(address) ||
    address.startsWith('ff') ||
    address.startsWith('2001:db8:')
  ) {
    return false
  }

  const mappedIpv4 = address.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  return mappedIpv4 ? isPublicIpv4Address(mappedIpv4) : true
}

export const isSafePublicUrl = (value: string | URL): boolean => {
  let url: URL

  try {
    url = value instanceof URL ? new URL(value) : new URL(value)
  } catch {
    return false
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    return false
  }

  if (
    url.port &&
    !(
      (url.protocol === 'http:' && url.port === '80') ||
      (url.protocol === 'https:' && url.port === '443')
    )
  ) {
    return false
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')

  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home') ||
    hostname.endsWith('.home.arpa')
  ) {
    return false
  }

  if (hostname.includes(':')) {
    return isPublicIpv6Address(hostname)
  }

  if (!hostname.includes('.') && !isIpv4Address(hostname)) {
    return false
  }

  return !isIpv4Address(hostname) || isPublicIpv4Address(hostname)
}

const safeUrl = (value: string, base?: URL): URL | null => {
  try {
    const url = base ? new URL(value, base) : new URL(value)
    return isSafePublicUrl(url) ? url : null
  } catch {
    return null
  }
}

const fetchWithRedirects = async (
  initialUrl: URL,
  fetcher: Fetcher,
  signal: AbortSignal,
  maxRedirects: number,
  headers: HeadersInit,
): Promise<FetchResult> => {
  let url = initialUrl

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (!isSafePublicUrl(url)) {
      throw new IconDiscoveryError('unsafe-url')
    }

    const response = await fetcher(url, {
      headers,
      redirect: 'manual',
      signal,
    })

    if (response.status < 300 || response.status >= 400) {
      return { response, url }
    }

    const location = response.headers.get('location')
    await response.body?.cancel()

    if (!location) {
      throw new IconDiscoveryError('fetch-failed')
    }

    const redirectUrl = safeUrl(location, url)

    if (!redirectUrl) {
      throw new IconDiscoveryError('unsafe-url')
    }

    url = redirectUrl
  }

  throw new IconDiscoveryError('too-many-redirects')
}

const readBoundedBody = async (
  response: Response,
  maximumBytes: number,
  retainBody = true,
): Promise<Uint8Array> => {
  const lengthHeader = response.headers.get('content-length')
  const declaredLength = lengthHeader === null ? null : Number(lengthHeader)

  if (
    declaredLength !== null &&
    Number.isFinite(declaredLength) &&
    declaredLength > maximumBytes
  ) {
    await response.body?.cancel()
    throw new IconDiscoveryError('response-too-large')
  }

  if (!response.body) {
    return new Uint8Array()
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      totalBytes += value.byteLength

      if (totalBytes > maximumBytes) {
        throw new IconDiscoveryError('response-too-large')
      }

      if (retainBody) {
        chunks.push(value)
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }

  if (!retainBody) {
    return new Uint8Array()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0

  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return body
}

const contentTypeIs = (response: Response, expected: RegExp): boolean =>
  expected.test(response.headers.get('content-type')?.toLowerCase() ?? '')

const parseLargestSize = (
  sizes: string | null,
): { width: number | null; height: number | null } => {
  if (!sizes) {
    return { width: null, height: null }
  }

  if (sizes.toLowerCase().split(/\s+/).includes('any')) {
    return { width: 4_096, height: 4_096 }
  }

  let largest: { width: number; height: number } | null = null

  for (const size of sizes.toLowerCase().split(/\s+/)) {
    const match = size.match(/^(\d{1,5})x(\d{1,5})$/)

    if (!match) {
      continue
    }

    const width = Number(match[1])
    const height = Number(match[2])

    if (width === 0 || height === 0) {
      continue
    }

    if (!largest || width * height > largest.width * largest.height) {
      largest = { width, height }
    }
  }

  return largest ?? { width: null, height: null }
}

const candidateFromLink = (
  href: string,
  pageUrl: URL,
  source: IconSource,
  sizes: string | null,
  type: string | null,
): IconCandidate | null => {
  const url = safeUrl(href, pageUrl)

  if (!url) {
    return null
  }

  return {
    url: url.toString(),
    source,
    ...parseLargestSize(sizes),
    type,
  }
}

const parsePage = async (html: Uint8Array, pageUrl: URL): Promise<ParsedPage> => {
  const state: ParsedPage & { titleParts: string[] } = {
    title: null,
    titleParts: [],
    appleIcons: [],
    favicons: [],
    manifests: [],
  }

  const rewriter = new HTMLRewriter()
    .on('title', {
      text(text) {
        if (state.titleParts.join('').length < 200) {
          state.titleParts.push(text.text)
        }
      },
    })
    .on('link', {
      element(element) {
        const href = element.getAttribute('href')
        const rel =
          element
            .getAttribute('rel')
            ?.toLowerCase()
            .split(/\s+/)
            .filter(Boolean) ?? []

        if (!href) {
          return
        }

        if (rel.includes('manifest')) {
          const manifestUrl = safeUrl(href, pageUrl)

          if (manifestUrl && !state.manifests.includes(manifestUrl.toString())) {
            state.manifests.push(manifestUrl.toString())
          }

          return
        }

        const isAppleIcon = rel.some((value) =>
          ['apple-touch-icon', 'apple-touch-icon-precomposed'].includes(value),
        )
        const isFavicon = rel.includes('icon') || rel.includes('shortcut')

        if (!isAppleIcon && !isFavicon) {
          return
        }

        const candidate = candidateFromLink(
          href,
          pageUrl,
          isAppleIcon ? 'apple-touch-icon' : 'favicon',
          element.getAttribute('sizes'),
          element.getAttribute('type'),
        )

        if (candidate) {
          if (isAppleIcon) {
            state.appleIcons.push(candidate)
          } else {
            state.favicons.push(candidate)
          }
        }
      },
    })

  await rewriter
    .transform(new Response(html, { headers: { 'Content-Type': 'text/html' } }))
    .arrayBuffer()
  state.title = state.titleParts.join('').replace(/\s+/g, ' ').trim().slice(0, 200) || null
  return state
}

const parseManifest = (
  manifest: unknown,
  manifestUrl: URL,
): IconCandidate[] => {
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('icons' in manifest) ||
    !Array.isArray(manifest.icons)
  ) {
    return []
  }

  return manifest.icons.flatMap((entry): IconCandidate[] => {
    if (typeof entry !== 'object' || entry === null || !('src' in entry)) {
      return []
    }

    const src = typeof entry.src === 'string' ? entry.src : null

    if (!src) {
      return []
    }

    const candidate = candidateFromLink(
      src,
      manifestUrl,
      'manifest',
      'sizes' in entry && typeof entry.sizes === 'string' ? entry.sizes : null,
      'type' in entry && typeof entry.type === 'string' ? entry.type : null,
    )

    return candidate ? [candidate] : []
  })
}

const candidateSize = (candidate: IconCandidate): number =>
  candidate.width && candidate.height ? candidate.width * candidate.height : 0

const rankCandidates = (candidates: IconCandidate[]): IconCandidate[] => {
  const sourcePriority: Record<IconSource, number> = {
    'apple-touch-icon': 0,
    manifest: 1,
    favicon: 2,
  }
  const unique = new Map<string, IconCandidate>()

  for (const candidate of candidates) {
    const existing = unique.get(candidate.url)

    if (!existing || candidateSize(candidate) > candidateSize(existing)) {
      unique.set(candidate.url, candidate)
    }
  }

  return [...unique.values()].sort((left, right) => {
    const sourceDifference =
      sourcePriority[left.source] - sourcePriority[right.source]
    return sourceDifference || candidateSize(right) - candidateSize(left)
  })
}

const loadManifestIcons = async (
  manifestUrls: string[],
  fetcher: Fetcher,
  signal: AbortSignal,
  maxRedirects: number,
  maximumBytes: number,
): Promise<IconCandidate[]> => {
  const firstManifestUrl = manifestUrls.map((url) => safeUrl(url)).find(Boolean)

  if (!firstManifestUrl) {
    return []
  }

  try {
    const { response, url } = await fetchWithRedirects(
      firstManifestUrl,
      fetcher,
      signal,
      maxRedirects,
      { Accept: 'application/manifest+json, application/json;q=0.9' },
    )

    if (
      !response.ok ||
      !contentTypeIs(response, /^(application\/manifest\+json|application\/json)\b/)
    ) {
      await response.body?.cancel()
      return []
    }

    const body = await readBoundedBody(response, maximumBytes)
    return parseManifest(JSON.parse(new TextDecoder().decode(body)), url)
  } catch {
    return []
  }
}

const validateIconCandidate = async (
  candidate: IconCandidate,
  fetcher: Fetcher,
  signal: AbortSignal,
  maxRedirects: number,
  maximumBytes: number,
): Promise<IconCandidate | null> => {
  try {
    const { response, url } = await fetchWithRedirects(
      new URL(candidate.url),
      fetcher,
      signal,
      maxRedirects,
      { Accept: 'image/*' },
    )
    if (!response.ok || !contentTypeIs(response, /^image\//)) {
      await response.body?.cancel()
      return null
    }

    await readBoundedBody(response, maximumBytes, false)
    return { ...candidate, url: url.toString() }
  } catch {
    return null
  }
}

export const discoverSiteMetadata = async (
  value: string,
  options: DiscoveryOptions = {},
): Promise<SiteMetadata> => {
  const initialUrl = safeUrl(value)

  if (!initialUrl) {
    return {
      pageUrl: value,
      title: null,
      icon: null,
      failure: 'unsafe-url',
    }
  }

  const fetcher = options.fetcher ?? fetch
  const maxRedirects = options.maxRedirects ?? ICON_DISCOVERY_LIMITS.redirects
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? ICON_DISCOVERY_LIMITS.timeoutMs,
  )

  try {
    const { response, url: pageUrl } = await fetchWithRedirects(
      initialUrl,
      fetcher,
      controller.signal,
      maxRedirects,
      {
        Accept: 'text/html, application/xhtml+xml;q=0.9',
        'User-Agent': 'WebVista/1.0 (+https://github.com/cmirza/webvista)',
      },
    )

    if (!response.ok) {
      await response.body?.cancel()
      throw new IconDiscoveryError('fetch-failed')
    }

    if (!contentTypeIs(response, /^(text\/html|application\/xhtml\+xml)\b/)) {
      await response.body?.cancel()
      throw new IconDiscoveryError('invalid-content-type')
    }

    const html = await readBoundedBody(
      response,
      options.htmlBytes ?? ICON_DISCOVERY_LIMITS.htmlBytes,
    )
    const page = await parsePage(html, pageUrl)
    const manifestIcons = await loadManifestIcons(
      page.manifests,
      fetcher,
      controller.signal,
      maxRedirects,
      options.manifestBytes ?? ICON_DISCOVERY_LIMITS.manifestBytes,
    )
    const defaultFavicon = candidateFromLink(
      '/favicon.ico',
      pageUrl,
      'favicon',
      null,
      'image/x-icon',
    )
    const candidates = rankCandidates([
      ...page.appleIcons,
      ...manifestIcons,
      ...page.favicons,
      ...(defaultFavicon ? [defaultFavicon] : []),
    ]).slice(
      0,
      options.maxCandidateProbes ?? ICON_DISCOVERY_LIMITS.candidateProbes,
    )

    for (const candidate of candidates) {
      const icon = await validateIconCandidate(
        candidate,
        fetcher,
        controller.signal,
        maxRedirects,
        options.iconBytes ?? ICON_DISCOVERY_LIMITS.iconBytes,
      )

      if (icon) {
        return {
          pageUrl: pageUrl.toString(),
          title: page.title,
          icon,
          failure: null,
        }
      }
    }

    return {
      pageUrl: pageUrl.toString(),
      title: page.title,
      icon: null,
      failure: null,
    }
  } catch (error) {
    return {
      pageUrl: initialUrl.toString(),
      title: null,
      icon: null,
      failure:
        error instanceof IconDiscoveryError ? error.code : 'fetch-failed',
    }
  } finally {
    clearTimeout(timeout)
  }
}
