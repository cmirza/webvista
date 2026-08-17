import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('favorites database migration', () => {
  it('creates the favorites schema and ordering index', async () => {
    const columns = await env.DB.prepare('PRAGMA table_info(favorites)').all<{
      name: string
    }>()
    const indexes = await env.DB.prepare('PRAGMA index_list(favorites)').all<{
      name: string
    }>()

    expect(columns.results.map(({ name }) => name)).toEqual([
      'id',
      'title',
      'url',
      'position',
      'icon_mode',
      'icon_url',
      'icon_storage_key',
      'enabled',
      'created_at',
      'updated_at',
    ])
    expect(indexes.results.map(({ name }) => name)).toContain(
      'favorites_enabled_position_idx',
    )
    expect(indexes.results.map(({ name }) => name)).not.toContain(
      'favorites_url_idx',
    )
  })

  it('stores valid favorites and rejects invalid constrained values', async () => {
    const insert = env.DB.prepare(`
      INSERT INTO favorites (
        id, title, url, position, icon_mode, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const timestamp = '2026-08-16T12:00:00.000Z'

    await insert
      .bind(
        'favorite-example',
        'Example',
        'https://example.com',
        10,
        'auto',
        1,
        timestamp,
        timestamp,
      )
      .run()

    await expect(
      insert
        .bind(
          'favorite-same-destination',
          'Same destination',
          'https://example.com',
          20,
          'fallback',
          1,
          timestamp,
          timestamp,
        )
        .run(),
    ).resolves.toBeDefined()

    const favorite = await env.DB.prepare(
      'SELECT id, position, icon_mode, enabled FROM favorites WHERE id = ?',
    )
      .bind('favorite-example')
      .first()

    expect(favorite).toEqual({
      id: 'favorite-example',
      position: 10,
      icon_mode: 'auto',
      enabled: 1,
    })

    await expect(
      insert
        .bind(
          'favorite-invalid-icon',
          'Invalid icon',
          'https://example.com/icon',
          20,
          'remote',
          1,
          timestamp,
          timestamp,
        )
        .run(),
    ).rejects.toThrow()

    await expect(
      insert
        .bind(
          'favorite-invalid-enabled',
          'Invalid enabled state',
          'https://example.com/enabled',
          20,
          'auto',
          2,
          timestamp,
          timestamp,
        )
        .run(),
    ).rejects.toThrow()
  })
})
