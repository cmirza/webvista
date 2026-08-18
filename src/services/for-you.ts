import { isSafePublicUrl } from './icons'

export interface ForYouItem {
  id: string
  url: string
  title: string
  description: string | null
  imageUrl: string | null
  sourceName: string
  position: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ForYouInput {
  url: string
  title: string
  description?: string | null
  imageUrl?: string | null
  sourceName: string
  enabled?: boolean
}

export class ForYouValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('For You item validation failed')
    this.name = 'ForYouValidationError'
  }
}

export class ForYouReorderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForYouReorderError'
  }
}

interface ForYouRow {
  id: string
  url: string
  title: string
  description: string | null
  image_url: string | null
  source_name: string
  position: number
  enabled: number
  created_at: string
  updated_at: string
}

const columns = `
  id, url, title, description, image_url, source_name, position,
  enabled, created_at, updated_at
`

const mapItem = (row: ForYouRow): ForYouItem => ({
  id: row.id,
  url: row.url,
  title: row.title,
  description: row.description,
  imageUrl: row.image_url,
  sourceName: row.source_name,
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
    throw new ForYouValidationError({ [field]: `Enter ${label}.` })
  }
  if (normalized.length > maximum) {
    throw new ForYouValidationError({
      [field]: `${label[0].toUpperCase()}${label.slice(1)} must be ${maximum} characters or fewer.`,
    })
  }
  return normalized
}

const optionalText = (
  value: string | null | undefined,
  field: string,
  label: string,
  maximum: number,
): string | null => {
  const normalized = value?.trim() ?? ''
  if (!normalized) {
    return null
  }
  if (normalized.length > maximum) {
    throw new ForYouValidationError({
      [field]: `${label} must be ${maximum} characters or fewer.`,
    })
  }
  return normalized
}

export const normalizeForYouUrl = (value: string): string => {
  const input = value.trim()
  let url: URL

  try {
    url = new URL(input)
  } catch {
    throw new ForYouValidationError({
      url: 'Enter a complete public website address beginning with http:// or https://.',
    })
  }

  if (!isSafePublicUrl(url)) {
    throw new ForYouValidationError({
      url: 'Enter a complete public website address beginning with http:// or https://.',
    })
  }

  url.hash = ''
  const normalized = url.toString()
  if (normalized.length > 2_048) {
    throw new ForYouValidationError({
      url: 'Website addresses must be 2,048 characters or fewer.',
    })
  }
  return normalized
}

const normalizeInput = (input: ForYouInput): Omit<ForYouInput, 'enabled'> & {
  description: string | null
  imageUrl: string | null
} => {
  const imageValue = input.imageUrl?.trim() ?? ''
  let imageUrl: string | null = null

  if (imageValue) {
    if (!isSafePublicUrl(imageValue) || imageValue.length > 2_048) {
      throw new ForYouValidationError({
        imageUrl: 'Enter a complete public HTTP or HTTPS image address.',
      })
    }
    imageUrl = new URL(imageValue).toString()
  }

  return {
    url: normalizeForYouUrl(input.url),
    title: requiredText(input.title, 'title', 'a title', 200),
    description: optionalText(
      input.description,
      'description',
      'Description',
      500,
    ),
    imageUrl,
    sourceName: requiredText(
      input.sourceName,
      'sourceName',
      'a source name',
      100,
    ),
  }
}

export const listForYouItems = async (
  db: D1Database,
  options: { enabledOnly?: boolean } = {},
): Promise<ForYouItem[]> => {
  const result = await db
    .prepare(`
      SELECT ${columns}
      FROM for_you_items
      ${options.enabledOnly ? 'WHERE enabled = 1' : ''}
      ORDER BY position ASC, created_at ASC, id ASC
    `)
    .all<ForYouRow>()
  return result.results.map(mapItem)
}

export const getForYouItem = async (
  db: D1Database,
  id: string,
): Promise<ForYouItem | null> => {
  const row = await db
    .prepare(`SELECT ${columns} FROM for_you_items WHERE id = ?`)
    .bind(id)
    .first<ForYouRow>()
  return row ? mapItem(row) : null
}

export const createForYouItem = async (
  db: D1Database,
  input: ForYouInput,
): Promise<ForYouItem> => {
  const values = normalizeInput(input)
  const id = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  const results = await db.batch<ForYouRow>([
    db
      .prepare(
        'UPDATE for_you_items SET position = position + 10, updated_at = ?',
      )
      .bind(timestamp),
    db
      .prepare(`
        INSERT INTO for_you_items (
          id, url, title, description, image_url, source_name, position,
          enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 10, ?, ?, ?)
        RETURNING ${columns}
      `)
      .bind(
        id,
        values.url,
        values.title,
        values.description,
        values.imageUrl,
        values.sourceName,
        input.enabled === false ? 0 : 1,
        timestamp,
        timestamp,
      ),
  ])
  const row = results[1]?.results[0]

  if (!row) {
    throw new Error('For You item could not be created.')
  }
  return mapItem(row)
}

export const updateForYouItem = async (
  db: D1Database,
  id: string,
  input: ForYouInput,
): Promise<ForYouItem | null> => {
  if (!(await getForYouItem(db, id))) {
    return null
  }

  const values = normalizeInput(input)
  const row = await db
    .prepare(`
      UPDATE for_you_items
      SET url = ?, title = ?, description = ?, image_url = ?,
          source_name = ?, enabled = ?, updated_at = ?
      WHERE id = ?
      RETURNING ${columns}
    `)
    .bind(
      values.url,
      values.title,
      values.description,
      values.imageUrl,
      values.sourceName,
      input.enabled === false ? 0 : 1,
      new Date().toISOString(),
      id,
    )
    .first<ForYouRow>()

  return row ? mapItem(row) : null
}

export const deleteForYouItem = async (
  db: D1Database,
  id: string,
): Promise<boolean> => {
  const deleted = await db
    .prepare('DELETE FROM for_you_items WHERE id = ? RETURNING id')
    .bind(id)
    .first<{ id: string }>()
  return Boolean(deleted)
}

export const reorderForYouItems = async (
  db: D1Database,
  ids: string[],
): Promise<ForYouItem[]> => {
  if (new Set(ids).size !== ids.length) {
    throw new ForYouReorderError('For You order contains duplicate IDs.')
  }

  const stored = await db
    .prepare(
      'SELECT id FROM for_you_items ORDER BY position ASC, created_at ASC, id ASC',
    )
    .all<{ id: string }>()
  const storedIds = new Set(stored.results.map(({ id }) => id))

  if (
    storedIds.size !== ids.length ||
    ids.some((id) => !storedIds.has(id))
  ) {
    throw new ForYouReorderError(
      'For You order must include every stored link exactly once.',
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
          'UPDATE for_you_items SET position = ?, updated_at = ? WHERE id = ?',
        )
        .bind((index + 1) * 10, timestamp, id),
    ),
  )

  return listForYouItems(db)
}

export const isForYouVisible = async (db: D1Database): Promise<boolean> => {
  const setting = await db
    .prepare("SELECT value FROM portal_settings WHERE key = 'for_you_enabled'")
    .first<{ value: string }>()
  return setting?.value !== '0'
}

export const setForYouVisible = async (
  db: D1Database,
  visible: boolean,
): Promise<void> => {
  await db
    .prepare(`
      INSERT INTO portal_settings (key, value, updated_at)
      VALUES ('for_you_enabled', ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `)
    .bind(visible ? '1' : '0', new Date().toISOString())
    .run()
}
