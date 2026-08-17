import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import {
  createFavorite,
  deleteFavorite,
  FavoriteReorderError,
  FavoriteValidationError,
  getFavorite,
  listFavorites,
  normalizeFavoriteUrl,
  reorderFavorites,
  updateFavorite,
} from '../src/services/favorites'

describe('favorites service', () => {
  it('creates normalized favorites with stable IDs and position gaps', async () => {
    const first = await createFavorite(env.DB, {
      title: '  Example  ',
      url: 'HTTPS://EXAMPLE.COM#top',
    })
    const second = await createFavorite(env.DB, {
      title: 'Cloudflare',
      url: 'https://cloudflare.com',
      iconMode: 'fallback',
      enabled: false,
    })

    expect(first).toMatchObject({
      title: 'Example',
      url: 'https://example.com/',
      position: 10,
      iconMode: 'auto',
      iconUrl: null,
      iconStorageKey: null,
      enabled: true,
    })
    expect(first.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(first.createdAt).toBe(first.updatedAt)
    expect(Number.isNaN(Date.parse(first.createdAt))).toBe(false)
    expect(second.position).toBe(20)
    expect(second.enabled).toBe(false)

    await expect(listFavorites(env.DB)).resolves.toEqual([first, second])
    await expect(listFavorites(env.DB, { enabledOnly: true })).resolves.toEqual([
      first,
    ])
  })

  it('looks up, updates, and deletes a favorite', async () => {
    const created = await createFavorite(env.DB, {
      title: 'Example',
      url: 'https://example.com',
    })
    const updated = await updateFavorite(env.DB, created.id, {
      title: ' Example Docs ',
      url: 'https://example.com/docs#intro',
      iconMode: 'upload',
      iconStorageKey:
        ' favorite-icons/123e4567-e89b-42d3-a456-426614174000.png ',
      enabled: false,
    })

    expect(updated).toMatchObject({
      id: created.id,
      title: 'Example Docs',
      url: 'https://example.com/docs',
      position: 10,
      iconMode: 'upload',
      iconStorageKey:
        'favorite-icons/123e4567-e89b-42d3-a456-426614174000.png',
      enabled: false,
      createdAt: created.createdAt,
    })
    await expect(getFavorite(env.DB, created.id)).resolves.toEqual(updated)
    await expect(
      updateFavorite(env.DB, 'missing', {
        title: 'Missing',
        url: 'https://example.com/missing',
        iconMode: 'auto',
        enabled: true,
      }),
    ).resolves.toBeNull()
    await expect(deleteFavorite(env.DB, created.id)).resolves.toBe(true)
    await expect(deleteFavorite(env.DB, created.id)).resolves.toBe(false)
    await expect(getFavorite(env.DB, created.id)).resolves.toBeNull()
  })

  it('validates URLs, titles, icon modes, and duplicate URLs', async () => {
    expect(normalizeFavoriteUrl('weather://')).toBe('weather://')
    expect(normalizeFavoriteUrl('shortcuts://run-shortcut?name=Morning')).toBe(
      'shortcuts://run-shortcut?name=Morning',
    )
    expect(normalizeFavoriteUrl('shortcuts://run-shortcut#Morning')).toBe(
      'shortcuts://run-shortcut#Morning',
    )
    for (const unsafeUrl of [
      'javascript:alert(1)',
      'data:text/html,hello',
      'file:///tmp/private',
      'about:blank',
    ]) {
      expect(() => normalizeFavoriteUrl(unsafeUrl)).toThrow(
        FavoriteValidationError,
      )
    }
    expect(() =>
      normalizeFavoriteUrl('https://user:secret@example.com'),
    ).toThrow(FavoriteValidationError)

    await expect(
      createFavorite(env.DB, { title: ' ', url: 'https://example.com' }),
    ).rejects.toMatchObject({ fieldErrors: { title: 'Enter a display name.' } })

    await createFavorite(env.DB, {
      title: 'Example',
      url: 'https://example.com',
    })
    await expect(
      createFavorite(env.DB, {
        title: 'Weather',
        url: 'weather://',
        iconMode: 'fallback',
      }),
    ).resolves.toMatchObject({ url: 'weather://' })
    await expect(
      createFavorite(env.DB, {
        title: 'Duplicate',
        url: 'HTTPS://EXAMPLE.COM/#different-fragment',
      }),
    ).rejects.toMatchObject({
      fieldErrors: { url: 'This address is already in Favorites.' },
    })
    await expect(
      createFavorite(env.DB, {
        title: 'Bad icon',
        url: 'https://example.org',
        iconMode: 'remote' as 'auto',
      }),
    ).rejects.toMatchObject({
      fieldErrors: { iconMode: 'Choose a valid icon source.' },
    })
  })

  it('normalizes a complete reorder into position gaps', async () => {
    const first = await createFavorite(env.DB, {
      title: 'First',
      url: 'https://first.example',
    })
    const second = await createFavorite(env.DB, {
      title: 'Second',
      url: 'https://second.example',
    })
    const third = await createFavorite(env.DB, {
      title: 'Third',
      url: 'https://third.example',
    })

    const reordered = await reorderFavorites(env.DB, [
      third.id,
      first.id,
      second.id,
    ])

    expect(reordered.map(({ id, position }) => ({ id, position }))).toEqual([
      { id: third.id, position: 10 },
      { id: first.id, position: 20 },
      { id: second.id, position: 30 },
    ])
  })

  it('rejects partial, duplicate, and unknown reorder payloads', async () => {
    const first = await createFavorite(env.DB, {
      title: 'First',
      url: 'https://first.example',
    })
    const second = await createFavorite(env.DB, {
      title: 'Second',
      url: 'https://second.example',
    })

    await expect(reorderFavorites(env.DB, [first.id])).rejects.toThrow(
      FavoriteReorderError,
    )
    await expect(reorderFavorites(env.DB, [first.id, first.id])).rejects.toThrow(
      FavoriteReorderError,
    )
    await expect(reorderFavorites(env.DB, [first.id, 'missing'])).rejects.toThrow(
      FavoriteReorderError,
    )

    expect((await listFavorites(env.DB)).map(({ id }) => id)).toEqual([
      first.id,
      second.id,
    ])
  })
})
