import { customIconFileName } from './icon-storage'

export const ICON_MODES = ['auto', 'upload', 'fallback'] as const

export type IconMode = (typeof ICON_MODES)[number]

export interface Favorite {
  id: string
  title: string
  url: string
  position: number
  iconMode: IconMode
  iconUrl: string | null
  iconStorageKey: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface FavoriteInput {
  title: string
  url: string
  iconMode?: IconMode
  iconUrl?: string | null
  iconStorageKey?: string | null
  enabled?: boolean
}

export interface FavoriteUpdate {
  title: string
  url: string
  iconMode: IconMode
  iconUrl?: string | null
  iconStorageKey?: string | null
  enabled: boolean
}

export class FavoriteValidationError extends Error {
  constructor(
    public readonly fieldErrors: Record<string, string>,
    message = 'Favorite validation failed',
  ) {
    super(message)
    this.name = 'FavoriteValidationError'
  }
}

export class FavoriteReorderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FavoriteReorderError'
  }
}

interface FavoriteRow {
  id: string
  title: string
  url: string
  position: number
  icon_mode: IconMode
  icon_url: string | null
  icon_storage_key: string | null
  enabled: number
  created_at: string
  updated_at: string
}

const favoriteColumns = `
  id, title, url, position, icon_mode, icon_url, icon_storage_key,
  enabled, created_at, updated_at
`

const mapFavorite = (row: FavoriteRow): Favorite => ({
  id: row.id,
  title: row.title,
  url: row.url,
  position: row.position,
  iconMode: row.icon_mode,
  iconUrl: row.icon_url,
  iconStorageKey: row.icon_storage_key,
  enabled: row.enabled === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const normalizeFavoriteTitle = (value: string): string => {
  const title = value.trim()

  if (!title) {
    throw new FavoriteValidationError({ title: 'Enter a display name.' })
  }

  if (title.length > 100) {
    throw new FavoriteValidationError({
      title: 'Display names must be 100 characters or fewer.',
    })
  }

  return title
}

export const normalizeFavoriteUrl = (value: string): string => {
  const input = value.trim()
  let url: URL

  try {
    url = new URL(input)
  } catch {
    throw new FavoriteValidationError({
      url: 'Enter a complete web address beginning with http:// or https://.',
    })
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new FavoriteValidationError({
      url: 'Enter a complete web address beginning with http:// or https://.',
    })
  }

  if (url.username || url.password) {
    throw new FavoriteValidationError({
      url: 'Web addresses containing credentials are not supported.',
    })
  }

  url.hash = ''
  const normalized = url.toString()

  if (normalized.length > 2_048) {
    throw new FavoriteValidationError({
      url: 'Web addresses must be 2,048 characters or fewer.',
    })
  }

  return normalized
}

const normalizeIconMode = (value: string): IconMode => {
  if (!ICON_MODES.includes(value as IconMode)) {
    throw new FavoriteValidationError({
      iconMode: 'Choose a valid icon source.',
    })
  }

  return value as IconMode
}

const normalizeOptionalValue = (
  value: string | null | undefined,
): string | null => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

const normalizeIconFields = (
  iconMode: IconMode,
  iconUrlValue?: string | null,
  iconStorageKeyValue?: string | null,
): { iconUrl: string | null; iconStorageKey: string | null } => {
  const iconUrl = normalizeOptionalValue(iconUrlValue)
  const iconStorageKey = normalizeOptionalValue(iconStorageKeyValue)

  if (iconMode === 'upload') {
    if (!iconStorageKey || !customIconFileName(iconStorageKey)) {
      throw new FavoriteValidationError({
        iconFile: 'Choose a valid custom icon.',
      })
    }

    return { iconUrl: null, iconStorageKey }
  }

  if (iconMode === 'fallback') {
    return { iconUrl: null, iconStorageKey: null }
  }

  return { iconUrl, iconStorageKey: null }
}

const ensureUrlAvailable = async (
  db: D1Database,
  url: string,
  excludedId?: string,
): Promise<void> => {
  const existing = await db
    .prepare(
      excludedId
        ? 'SELECT id FROM favorites WHERE url = ? AND id != ? LIMIT 1'
        : 'SELECT id FROM favorites WHERE url = ? LIMIT 1',
    )
    .bind(...(excludedId ? [url, excludedId] : [url]))
    .first<{ id: string }>()

  if (existing) {
    throw new FavoriteValidationError({
      url: 'This web address is already in Favorites.',
    })
  }
}

export const listFavorites = async (
  db: D1Database,
  options: { enabledOnly?: boolean } = {},
): Promise<Favorite[]> => {
  const result = await db
    .prepare(`
      SELECT ${favoriteColumns}
      FROM favorites
      ${options.enabledOnly ? 'WHERE enabled = 1' : ''}
      ORDER BY position ASC, created_at ASC, id ASC
    `)
    .all<FavoriteRow>()

  return result.results.map(mapFavorite)
}

export const getFavorite = async (
  db: D1Database,
  id: string,
): Promise<Favorite | null> => {
  const row = await db
    .prepare(`SELECT ${favoriteColumns} FROM favorites WHERE id = ?`)
    .bind(id)
    .first<FavoriteRow>()

  return row ? mapFavorite(row) : null
}

export const createFavorite = async (
  db: D1Database,
  input: FavoriteInput,
): Promise<Favorite> => {
  const title = normalizeFavoriteTitle(input.title)
  const url = normalizeFavoriteUrl(input.url)
  const iconMode = normalizeIconMode(input.iconMode ?? 'auto')
  const { iconUrl, iconStorageKey } = normalizeIconFields(
    iconMode,
    input.iconUrl,
    input.iconStorageKey,
  )

  await ensureUrlAvailable(db, url)

  const nextPosition = await db
    .prepare('SELECT COALESCE(MAX(position), 0) + 10 AS position FROM favorites')
    .first<{ position: number }>()
  const id = crypto.randomUUID()
  const timestamp = new Date().toISOString()

  const favorite = await db
    .prepare(`
      INSERT INTO favorites (
        id, title, url, position, icon_mode, icon_url, icon_storage_key,
        enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING ${favoriteColumns}
    `)
    .bind(
      id,
      title,
      url,
      nextPosition?.position ?? 10,
      iconMode,
      iconUrl,
      iconStorageKey,
      input.enabled === false ? 0 : 1,
      timestamp,
      timestamp,
    )
    .first<FavoriteRow>()

  if (!favorite) {
    throw new Error('Favorite could not be created.')
  }

  return mapFavorite(favorite)
}

export const updateFavorite = async (
  db: D1Database,
  id: string,
  input: FavoriteUpdate,
): Promise<Favorite | null> => {
  if (!(await getFavorite(db, id))) {
    return null
  }

  const title = normalizeFavoriteTitle(input.title)
  const url = normalizeFavoriteUrl(input.url)
  const iconMode = normalizeIconMode(input.iconMode)
  const { iconUrl, iconStorageKey } = normalizeIconFields(
    iconMode,
    input.iconUrl,
    input.iconStorageKey,
  )

  await ensureUrlAvailable(db, url, id)

  const updated = await db
    .prepare(`
      UPDATE favorites
      SET title = ?, url = ?, icon_mode = ?, icon_url = ?,
          icon_storage_key = ?, enabled = ?, updated_at = ?
      WHERE id = ?
      RETURNING ${favoriteColumns}
    `)
    .bind(
      title,
      url,
      iconMode,
      iconUrl,
      iconStorageKey,
      input.enabled ? 1 : 0,
      new Date().toISOString(),
      id,
    )
    .first<FavoriteRow>()

  return updated ? mapFavorite(updated) : null
}

export const deleteFavorite = async (
  db: D1Database,
  id: string,
): Promise<boolean> => {
  const result = await db
    .prepare('DELETE FROM favorites WHERE id = ?')
    .bind(id)
    .run()
  return result.meta.changes > 0
}

export const reorderFavorites = async (
  db: D1Database,
  ids: string[],
): Promise<Favorite[]> => {
  const uniqueIds = new Set(ids)

  if (uniqueIds.size !== ids.length) {
    throw new FavoriteReorderError('Favorite order contains duplicate IDs.')
  }

  const storedIds = await db
    .prepare(
      'SELECT id FROM favorites ORDER BY position ASC, created_at ASC, id ASC',
    )
    .all<{ id: string }>()
  const storedIdSet = new Set(storedIds.results.map(({ id }) => id))

  if (
    storedIdSet.size !== ids.length ||
    ids.some((id) => !storedIdSet.has(id))
  ) {
    throw new FavoriteReorderError(
      'Favorite order must include every stored favorite exactly once.',
    )
  }

  if (ids.length === 0) {
    return []
  }

  const timestamp = new Date().toISOString()
  await db.batch(
    ids.map((id, index) =>
      db
        .prepare('UPDATE favorites SET position = ?, updated_at = ? WHERE id = ?')
        .bind((index + 1) * 10, timestamp, id),
    ),
  )

  return listFavorites(db)
}
