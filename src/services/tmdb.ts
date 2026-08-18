import {
  parseWatchMetadataId,
  WatchValidationError,
  type WatchMediaType,
} from './watch'

const TMDB_API_ORIGIN = 'https://api.themoviedb.org'
const TMDB_POSTER_ORIGIN = 'https://image.tmdb.org/t/p/w500'
const MAX_RESPONSE_BYTES = 1_000_000

export interface WatchMetadata {
  tmdbId: number
  imdbId: string | null
  title: string
  year: number | null
  mediaType: WatchMediaType
  posterUrl: string | null
}

export class TmdbLookupError extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage)
    this.name = 'TmdbLookupError'
  }
}

interface TmdbResult {
  id?: unknown
  title?: unknown
  name?: unknown
  release_date?: unknown
  first_air_date?: unknown
  poster_path?: unknown
  imdb_id?: unknown
}

const textValue = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const numberValue = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null

const mapResult = (
  result: TmdbResult,
  mediaType: WatchMediaType,
  imdbId: string | null,
): WatchMetadata => {
  const tmdbId = numberValue(result.id)
  const title = textValue(mediaType === 'movie' ? result.title : result.name)
  if (!tmdbId || !title) {
    throw new TmdbLookupError('TMDb returned incomplete title details.')
  }

  const date = textValue(
    mediaType === 'movie' ? result.release_date : result.first_air_date,
  )
  const parsedYear = date?.match(/^(\d{4})/)?.[1]
  const posterPath = textValue(result.poster_path)

  return {
    tmdbId,
    imdbId: textValue(result.imdb_id) ?? imdbId,
    title,
    year: parsedYear ? Number(parsedYear) : null,
    mediaType,
    posterUrl:
      posterPath && posterPath.startsWith('/')
        ? `${TMDB_POSTER_ORIGIN}${posterPath}`
        : null,
  }
}

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  const declaredLength = Number(response.headers.get('content-length') ?? '0')
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new TmdbLookupError('TMDb returned more data than expected.')
  }
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new TmdbLookupError('TMDb returned more data than expected.')
  }
  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Unexpected JSON shape')
    }
    return parsed as Record<string, unknown>
  } catch {
    throw new TmdbLookupError('TMDb returned an unreadable response.')
  }
}

export async function lookupWatchMetadata(
  identifier: string,
  selectedMediaType: string,
  token: string | undefined,
  options: { fetcher?: typeof fetch } = {},
): Promise<WatchMetadata> {
  const normalizedToken = token?.trim()
  if (!normalizedToken) {
    throw new TmdbLookupError(
      'TMDb lookup is not configured yet. You can still enter every field manually.',
    )
  }

  let parsed
  try {
    parsed = parseWatchMetadataId(identifier, selectedMediaType)
  } catch (error) {
    if (error instanceof WatchValidationError) {
      throw new TmdbLookupError(
        error.fieldErrors.metadataId ?? 'Enter a valid IMDb or TMDb ID.',
      )
    }
    if (error instanceof Error) {
      throw new TmdbLookupError(error.message)
    }
    throw error
  }
  if (!parsed) {
    throw new TmdbLookupError('Enter an IMDb or TMDb ID to preview details.')
  }

  const endpoint =
    parsed.source === 'imdb'
      ? `/3/find/${encodeURIComponent(parsed.imdbId)}?external_source=imdb_id&language=en-US`
      : `/3/${parsed.mediaType}/${parsed.tmdbId}?language=en-US`
  const fetcher = options.fetcher ?? fetch
  let response: Response

  try {
    response = await fetcher(`${TMDB_API_ORIGIN}${endpoint}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizedToken}`,
      },
      signal: AbortSignal.timeout(4_000),
    })
  } catch {
    throw new TmdbLookupError('TMDb could not be reached. Try again or enter the details manually.')
  }

  if (response.status === 401 || response.status === 403) {
    throw new TmdbLookupError('The configured TMDb API read token was not accepted.')
  }
  if (response.status === 404) {
    throw new TmdbLookupError('TMDb could not find that title.')
  }
  if (!response.ok) {
    throw new TmdbLookupError('TMDb could not retrieve that title. Try again later.')
  }

  const payload = await readJson(response)
  if (parsed.source === 'tmdb') {
    return mapResult(payload, parsed.mediaType, null)
  }

  const movieResults = Array.isArray(payload.movie_results)
    ? (payload.movie_results as TmdbResult[])
    : []
  const tvResults = Array.isArray(payload.tv_results)
    ? (payload.tv_results as TmdbResult[])
    : []
  const preferred =
    parsed.preferredMediaType === 'tv'
      ? ([tvResults[0], 'tv'] as const)
      : ([movieResults[0], 'movie'] as const)
  const fallback =
    parsed.preferredMediaType === 'tv'
      ? ([movieResults[0], 'movie'] as const)
      : ([tvResults[0], 'tv'] as const)
  const [result, mediaType] = preferred[0] ? preferred : fallback
  if (!result) {
    throw new TmdbLookupError('TMDb could not find a movie or TV show for that IMDb ID.')
  }
  return mapResult(result, mediaType, parsed.imdbId)
}
