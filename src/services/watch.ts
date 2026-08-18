import { normalizeFavoriteUrl, FavoriteValidationError } from './favorites'
import { isSafePublicUrl } from './icons'

export const WATCH_MEDIA_TYPES = ['movie', 'tv'] as const
export type WatchMediaType = (typeof WATCH_MEDIA_TYPES)[number]

export interface WatchItem {
  id: string
  title: string
  year: number | null
  mediaType: WatchMediaType
  posterUrl: string | null
  serviceName: string
  watchUrl: string
  tmdbId: number | null
  imdbId: string | null
  position: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface WatchInput {
  title: string
  year?: string | number | null
  mediaType: string
  posterUrl?: string | null
  serviceName: string
  watchUrl: string
  metadataId?: string | null
  enabled?: boolean
}

export class WatchValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Watch item validation failed')
    this.name = 'WatchValidationError'
  }
}

export class WatchReorderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WatchReorderError'
  }
}

interface WatchRow {
  id: string
  title: string
  year: number | null
  media_type: WatchMediaType
  poster_url: string | null
  service_name: string
  watch_url: string
  tmdb_id: number | null
  imdb_id: string | null
  position: number
  enabled: number
  created_at: string
  updated_at: string
}

const columns = `
  id, title, year, media_type, poster_url, service_name, watch_url,
  position, enabled, created_at, updated_at, tmdb_id, imdb_id
`

const mapItem = (row: WatchRow): WatchItem => ({
  id: row.id,
  title: row.title,
  year: row.year,
  mediaType: row.media_type,
  posterUrl: row.poster_url,
  serviceName: row.service_name,
  watchUrl: row.watch_url,
  tmdbId: row.tmdb_id,
  imdbId: row.imdb_id,
  position: row.position,
  enabled: row.enabled === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const requiredText = (
  value: string,
  field: string,
  label: string,
  maximum: number,
): string => {
  const normalized = value.trim()
  if (!normalized) {
    throw new WatchValidationError({ [field]: `Enter ${label}.` })
  }
  if (normalized.length > maximum) {
    throw new WatchValidationError({
      [field]: `${label[0].toUpperCase()}${label.slice(1)} must be ${maximum} characters or fewer.`,
    })
  }
  return normalized
}

export type ParsedWatchMetadataId =
  | {
      source: 'imdb'
      imdbId: string
      preferredMediaType: WatchMediaType
    }
  | {
      source: 'tmdb'
      tmdbId: number
      mediaType: WatchMediaType
    }

export const parseWatchMetadataId = (
  value: string,
  selectedMediaType: string,
): ParsedWatchMetadataId | null => {
  const input = value.trim()
  if (!input) {
    return null
  }
  const preferredMediaType = WATCH_MEDIA_TYPES.includes(
    selectedMediaType as WatchMediaType,
  )
    ? (selectedMediaType as WatchMediaType)
    : 'movie'

  let candidate = input
  try {
    const url = new URL(input)
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase()
    if (hostname === 'imdb.com') {
      candidate = url.pathname.match(/\/title\/(tt\d+)/i)?.[1] ?? ''
    } else if (hostname === 'themoviedb.org') {
      const match = url.pathname.match(/^\/(movie|tv)\/(\d+)/i)
      candidate = match ? `${match[1]}/${match[2]}` : ''
    }
  } catch {
    // Plain identifiers are handled below.
  }

  const imdbMatch = candidate.match(/^(tt\d{7,12})$/i)
  if (imdbMatch) {
    return {
      source: 'imdb',
      imdbId: imdbMatch[1].toLowerCase(),
      preferredMediaType,
    }
  }

  const tmdbMatch = candidate.match(/^(?:tmdb:)?(movie|tv)[/:](\d+)$/i)
  const numericMatch = candidate.match(/^(?:tmdb:)?(\d+)$/i)
  const id = Number(tmdbMatch?.[2] ?? numericMatch?.[1])
  if (Number.isSafeInteger(id) && id > 0) {
    return {
      source: 'tmdb',
      tmdbId: id,
      mediaType: tmdbMatch
        ? (tmdbMatch[1].toLowerCase() as WatchMediaType)
        : preferredMediaType,
    }
  }

  throw new WatchValidationError({
    metadataId:
      'Enter an IMDb ID such as tt0137523, or a TMDb ID such as movie/550 or tv/95396.',
  })
}

const normalizeInput = (input: WatchInput) => {
  let watchUrl: string
  try {
    watchUrl = normalizeFavoriteUrl(input.watchUrl, {
      preserveWebFragment: true,
    })
  } catch (error) {
    if (error instanceof FavoriteValidationError) {
      throw new WatchValidationError({
        watchUrl:
          error.fieldErrors.url ?? 'Enter a complete web or app address.',
      })
    }
    throw error
  }

  const rawYear = `${input.year ?? ''}`.trim()
  const year = rawYear ? Number(rawYear) : null
  if (
    year !== null &&
    (!Number.isInteger(year) || year < 1888 || year > 2100)
  ) {
    throw new WatchValidationError({
      year: 'Enter a year from 1888 through 2100, or leave it blank.',
    })
  }

  if (!WATCH_MEDIA_TYPES.includes(input.mediaType as WatchMediaType)) {
    throw new WatchValidationError({
      mediaType: 'Choose Movie or TV show.',
    })
  }

  const externalId = parseWatchMetadataId(input.metadataId ?? '', input.mediaType)

  const rawPosterUrl = input.posterUrl?.trim() ?? ''
  let posterUrl: string | null = null
  if (rawPosterUrl) {
    if (!isSafePublicUrl(rawPosterUrl) || rawPosterUrl.length > 2_048) {
      throw new WatchValidationError({
        posterUrl: 'Enter a complete public HTTP or HTTPS image address.',
      })
    }
    posterUrl = new URL(rawPosterUrl).toString()
  }

  return {
    title: requiredText(input.title, 'title', 'a title', 200),
    year,
    mediaType: input.mediaType as WatchMediaType,
    posterUrl,
    serviceName: requiredText(
      input.serviceName,
      'serviceName',
      'a streaming service',
      100,
    ),
    watchUrl,
    tmdbId: externalId?.source === 'tmdb' ? externalId.tmdbId : null,
    imdbId: externalId?.source === 'imdb' ? externalId.imdbId : null,
  }
}

export const listWatchItems = async (
  db: D1Database,
  options: { enabledOnly?: boolean } = {},
): Promise<WatchItem[]> => {
  const result = await db
    .prepare(`
      SELECT ${columns}
      FROM watch_items
      ${options.enabledOnly ? 'WHERE enabled = 1' : ''}
      ORDER BY position ASC, created_at ASC, id ASC
    `)
    .all<WatchRow>()
  return result.results.map(mapItem)
}

export const getWatchItem = async (
  db: D1Database,
  id: string,
): Promise<WatchItem | null> => {
  const row = await db
    .prepare(`SELECT ${columns} FROM watch_items WHERE id = ?`)
    .bind(id)
    .first<WatchRow>()
  return row ? mapItem(row) : null
}

export const createWatchItem = async (
  db: D1Database,
  input: WatchInput,
): Promise<WatchItem> => {
  const values = normalizeInput(input)
  const id = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  const results = await db.batch<WatchRow>([
    db
      .prepare('UPDATE watch_items SET position = position + 10, updated_at = ?')
      .bind(timestamp),
    db
      .prepare(`
        INSERT INTO watch_items (
          id, title, year, media_type, poster_url, service_name, watch_url,
          position, enabled, created_at, updated_at, tmdb_id, imdb_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 10, ?, ?, ?, ?, ?)
        RETURNING ${columns}
      `)
      .bind(
        id,
        values.title,
        values.year,
        values.mediaType,
        values.posterUrl,
        values.serviceName,
        values.watchUrl,
        input.enabled === false ? 0 : 1,
        timestamp,
        timestamp,
        values.tmdbId,
        values.imdbId,
      ),
  ])
  const row = results[1].results[0]
  if (!row) {
    throw new Error('Watch item was not returned after creation.')
  }
  return mapItem(row)
}

export const updateWatchItem = async (
  db: D1Database,
  id: string,
  input: WatchInput,
): Promise<WatchItem | null> => {
  if (!(await getWatchItem(db, id))) {
    return null
  }
  const values = normalizeInput(input)
  const row = await db
    .prepare(`
      UPDATE watch_items
      SET title = ?, year = ?, media_type = ?, poster_url = ?,
          service_name = ?, watch_url = ?, enabled = ?, updated_at = ?,
          tmdb_id = ?, imdb_id = ?
      WHERE id = ?
      RETURNING ${columns}
    `)
    .bind(
      values.title,
      values.year,
      values.mediaType,
      values.posterUrl,
      values.serviceName,
      values.watchUrl,
      input.enabled === false ? 0 : 1,
      new Date().toISOString(),
      values.tmdbId,
      values.imdbId,
      id,
    )
    .first<WatchRow>()
  return row ? mapItem(row) : null
}

export const deleteWatchItem = async (
  db: D1Database,
  id: string,
): Promise<boolean> => {
  const deleted = await db
    .prepare('DELETE FROM watch_items WHERE id = ? RETURNING id')
    .bind(id)
    .first<{ id: string }>()
  return Boolean(deleted)
}

export const reorderWatchItems = async (
  db: D1Database,
  ids: string[],
): Promise<WatchItem[]> => {
  if (new Set(ids).size !== ids.length) {
    throw new WatchReorderError('Watch order contains duplicate IDs.')
  }

  const stored = await db
    .prepare(
      'SELECT id FROM watch_items ORDER BY position ASC, created_at ASC, id ASC',
    )
    .all<{ id: string }>()
  const storedIds = new Set(stored.results.map(({ id }) => id))

  if (
    storedIds.size !== ids.length ||
    ids.some((id) => !storedIds.has(id))
  ) {
    throw new WatchReorderError(
      'Watch order must include every stored title exactly once.',
    )
  }

  if (ids.length === 0) {
    return []
  }

  const timestamp = new Date().toISOString()
  await db.batch(
    ids.map((id, index) =>
      db
        .prepare(
          'UPDATE watch_items SET position = ?, updated_at = ? WHERE id = ?',
        )
        .bind((index + 1) * 10, timestamp, id),
    ),
  )

  return listWatchItems(db)
}
