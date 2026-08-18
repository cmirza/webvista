import { env, exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it, vi } from 'vitest'
import {
  createWatchItem,
  deleteWatchItem,
  getWatchItem,
  listWatchItems,
  parseWatchMetadataId,
  reorderWatchItems,
  updateWatchItem,
  WatchReorderError,
} from '../src/services/watch'
import { lookupWatchMetadata } from '../src/services/tmdb'
import { createForYouItem } from '../src/services/for-you'

const origin = 'https://webvista.test'

async function login(): Promise<string> {
  const response = await workerExports.default.fetch(
    new Request(`${origin}/admin/login`, {
      body: new URLSearchParams({ password: env.ADMIN_PASSWORD }),
      headers: { Origin: origin },
      method: 'POST',
      redirect: 'manual',
    }),
  )
  return (response.headers.get('set-cookie') ?? '').split(';', 1)[0]
}

describe('Watch items', () => {
  it('normalizes IMDb and TMDb identifiers and title URLs', () => {
    expect(parseWatchMetadataId('tt0137523', 'movie')).toEqual({
      source: 'imdb',
      imdbId: 'tt0137523',
      preferredMediaType: 'movie',
    })
    expect(
      parseWatchMetadataId('https://www.imdb.com/title/tt11280740/', 'tv'),
    ).toMatchObject({ source: 'imdb', imdbId: 'tt11280740' })
    expect(parseWatchMetadataId('movie/550', 'tv')).toEqual({
      source: 'tmdb',
      tmdbId: 550,
      mediaType: 'movie',
    })
    expect(
      parseWatchMetadataId(
        'https://www.themoviedb.org/tv/95396-severance',
        'movie',
      ),
    ).toEqual({ source: 'tmdb', tmdbId: 95396, mediaType: 'tv' })
    expect(parseWatchMetadataId('95396', 'tv')).toEqual({
      source: 'tmdb',
      tmdbId: 95396,
      mediaType: 'tv',
    })
  })

  it('retrieves editable movie and IMDb TV details from TMDb', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.includes('/3/movie/550')) {
        return new Response(
          JSON.stringify({
            id: 550,
            title: 'Fight Club',
            release_date: '1999-10-15',
            poster_path: '/poster.jpg',
            imdb_id: 'tt0137523',
          }),
        )
      }
      return new Response(
        JSON.stringify({
          movie_results: [],
          tv_results: [
            {
              id: 95396,
              name: 'Severance',
              first_air_date: '2022-02-17',
              poster_path: '/severance.jpg',
            },
          ],
        }),
      )
    })

    await expect(
      lookupWatchMetadata('movie/550', 'movie', 'test-token', { fetcher }),
    ).resolves.toEqual({
      tmdbId: 550,
      imdbId: 'tt0137523',
      title: 'Fight Club',
      year: 1999,
      mediaType: 'movie',
      posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    })
    await expect(
      lookupWatchMetadata('tt11280740', 'tv', 'test-token', { fetcher }),
    ).resolves.toMatchObject({
      tmdbId: 95396,
      imdbId: 'tt11280740',
      title: 'Severance',
      year: 2022,
      mediaType: 'tv',
    })
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/3/find/tt11280740?external_source=imdb_id'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    )
  })

  it('keeps manual entry available when TMDb is not configured', async () => {
    await expect(
      lookupWatchMetadata('movie/550', 'movie', undefined),
    ).rejects.toMatchObject({
      userMessage: expect.stringContaining('not configured'),
    })
  })

  it('stores newest titles first and filters disabled titles', async () => {
    const older = await createWatchItem(env.DB, {
      title: 'Older Movie',
      year: '2024',
      mediaType: 'movie',
      posterUrl: 'https://images.example/older.jpg',
      serviceName: 'Plex',
      watchUrl: 'https://app.plex.tv/desktop/#!/details/older',
    })
    const hidden = await createWatchItem(env.DB, {
      title: 'Hidden Show',
      mediaType: 'tv',
      serviceName: 'Netflix',
      watchUrl: 'nflx://www.netflix.com/title/123',
      enabled: false,
    })

    expect(older.position).toBe(10)
    expect(hidden.position).toBe(10)
    expect((await listWatchItems(env.DB)).map(({ title, position }) => ({ title, position }))).toEqual([
      { title: 'Hidden Show', position: 10 },
      { title: 'Older Movie', position: 20 },
    ])
    await expect(listWatchItems(env.DB, { enabledOnly: true })).resolves.toMatchObject([
      { id: older.id, position: 20 },
    ])
  })

  it('preserves hash-routed Plex destinations through storage and rendering', async () => {
    const plexUrl =
      'https://app.plex.tv/desktop/#!/server/673f7dbca094329285d13114d37795c8d150fb9f/details?key=%2Flibrary%2Fmetadata%2F4275'
    const item = await createWatchItem(env.DB, {
      title: 'Plex Movie',
      mediaType: 'movie',
      serviceName: 'Plex',
      watchUrl: plexUrl,
    })

    expect(item.watchUrl).toBe(plexUrl)
    await expect(getWatchItem(env.DB, item.id)).resolves.toMatchObject({
      watchUrl: plexUrl,
    })
    const portal = await workerExports.default.fetch(`${origin}/`)
    expect(await portal.text()).toContain(`href="${plexUrl}"`)
  })

  it('updates and removes saved titles without changing their position', async () => {
    const created = await createWatchItem(env.DB, {
      title: 'Original Movie',
      year: '2024',
      mediaType: 'movie',
      serviceName: 'Plex',
      watchUrl: 'https://app.plex.tv/original',
      metadataId: 'movie/550',
    })

    const updated = await updateWatchItem(env.DB, created.id, {
      title: 'Updated Show',
      year: '2025',
      mediaType: 'tv',
      posterUrl: 'https://images.example/updated.jpg',
      serviceName: 'Apple TV',
      watchUrl: 'https://tv.apple.com/show/updated',
      metadataId: 'tt11280740',
      enabled: false,
    })

    expect(updated).toMatchObject({
      id: created.id,
      title: 'Updated Show',
      year: 2025,
      mediaType: 'tv',
      serviceName: 'Apple TV',
      enabled: false,
      imdbId: 'tt11280740',
      tmdbId: null,
      position: created.position,
    })
    await expect(getWatchItem(env.DB, created.id)).resolves.toMatchObject({
      title: 'Updated Show',
    })
    await expect(deleteWatchItem(env.DB, created.id)).resolves.toBe(true)
    await expect(getWatchItem(env.DB, created.id)).resolves.toBeNull()
  })

  it('validates complete title sets and normalizes reordered positions', async () => {
    const first = await createWatchItem(env.DB, {
      title: 'First',
      mediaType: 'movie',
      serviceName: 'Plex',
      watchUrl: 'https://app.plex.tv/first',
    })
    const second = await createWatchItem(env.DB, {
      title: 'Second',
      mediaType: 'tv',
      serviceName: 'Netflix',
      watchUrl: 'https://www.netflix.com/second',
    })
    const third = await createWatchItem(env.DB, {
      title: 'Third',
      mediaType: 'movie',
      serviceName: 'Prime Video',
      watchUrl: 'https://www.amazon.com/third',
    })

    const reordered = await reorderWatchItems(env.DB, [
      first.id,
      third.id,
      second.id,
    ])
    expect(reordered.map(({ id, position }) => ({ id, position }))).toEqual([
      { id: first.id, position: 10 },
      { id: third.id, position: 20 },
      { id: second.id, position: 30 },
    ])
    await expect(
      reorderWatchItems(env.DB, [first.id, first.id, second.id]),
    ).rejects.toThrow(WatchReorderError)
    await expect(
      reorderWatchItems(env.DB, [first.id, second.id]),
    ).rejects.toThrow(WatchReorderError)
    await expect(
      reorderWatchItems(env.DB, [first.id, third.id, 'missing']),
    ).rejects.toThrow(WatchReorderError)
  })

  it('rejects unsafe links, posters, years, and media types', async () => {
    const base = {
      title: 'Invalid',
      mediaType: 'movie',
      serviceName: 'Example',
      watchUrl: 'https://example.com/watch',
    }
    await expect(createWatchItem(env.DB, { ...base, watchUrl: 'javascript:alert(1)' }))
      .rejects.toMatchObject({ fieldErrors: { watchUrl: expect.any(String) } })
    await expect(createWatchItem(env.DB, { ...base, posterUrl: 'http://127.0.0.1/poster.jpg' }))
      .rejects.toMatchObject({ fieldErrors: { posterUrl: expect.any(String) } })
    await expect(createWatchItem(env.DB, { ...base, year: '1700' }))
      .rejects.toMatchObject({ fieldErrors: { year: expect.any(String) } })
    await expect(createWatchItem(env.DB, { ...base, mediaType: 'clip' }))
      .rejects.toMatchObject({ fieldErrors: { mediaType: expect.any(String) } })
    await expect(
      createWatchItem(env.DB, {
        ...base,
        watchUrl: `https://example.com/#${'a'.repeat(2_050)}`,
      }),
    ).rejects.toMatchObject({ fieldErrors: { watchUrl: expect.any(String) } })
  })

  it('renders enabled titles in a same-tab poster carousel', async () => {
    const shown = await createWatchItem(env.DB, {
      title: 'A Great Film',
      year: 2026,
      mediaType: 'movie',
      posterUrl: 'https://images.example/film.jpg',
      serviceName: 'Prime Video',
      watchUrl: 'https://www.amazon.com/gp/video/detail/example',
    })
    const hidden = await createWatchItem(env.DB, {
      title: 'Hidden Film',
      mediaType: 'movie',
      serviceName: 'Plex',
      watchUrl: 'https://app.plex.tv/hidden',
      enabled: false,
    })
    await createForYouItem(env.DB, {
      title: 'A story below Watch',
      sourceName: 'Example News',
      url: 'https://news.example/story',
    })
    const response = await workerExports.default.fetch(`${origin}/`)
    const body = await response.text()

    expect(body).toContain('id="watch-track"')
    expect(body).toContain(`data-watch-id="${shown.id}"`)
    expect(body).toContain(`href="${shown.watchUrl}"`)
    expect(body).toContain('Prime Video')
    expect(body).toContain('2026 · Movie')
    expect(body).toContain('referrerpolicy="no-referrer"')
    expect(body).not.toContain(hidden.id)
    expect(body).not.toContain('target="_blank"')
    expect(body.indexOf('id="watch-heading"')).toBeLessThan(
      body.indexOf('id="for-you-heading"'),
    )
  })

  it('provides authenticated add and validation flows', async () => {
    const cookie = await login()
    const headers = { Cookie: cookie, Origin: origin }
    const addPage = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/new`, { headers }),
    )
    const addBody = await addPage.text()
    expect(addPage.status).toBe(200)
    expect(addBody).toContain('action="/admin/watch"')
    expect(addBody).toContain('Add Title')
    expect(addBody).toContain('formaction="/admin/watch/preview"')

    const enhancedAddPage = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/new`, {
        headers: { ...headers, 'HX-Request': 'true' },
      }),
    )
    const enhancedAddBody = await enhancedAddPage.text()
    expect(enhancedAddBody).toContain('hx-get="/admin/watch/preview"')
    expect(enhancedAddBody).toContain('hx-include="closest form"')
    expect(enhancedAddBody).toContain('hx-target="#watch-form-shell"')
    expect(enhancedAddBody).not.toContain('<html')
    const previewButton = enhancedAddBody.match(
      /<button[^>]*data-watch-preview-button[^>]*>/,
    )?.[0]
    expect(previewButton).toBeDefined()
    expect(previewButton).not.toContain('btn-lg')

    const enhancedPreview = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/preview?metadataId=`, {
        headers: { ...headers, 'HX-Request': 'true' },
      }),
    )
    const enhancedPreviewBody = await enhancedPreview.text()
    expect(enhancedPreview.status).toBe(422)
    expect(enhancedPreviewBody).toContain('id="watch-form-shell"')
    expect(enhancedPreviewBody).not.toContain('<html')

    const normalPreview = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/preview?metadataId=`, { headers }),
    )
    expect(normalPreview.status).toBe(422)
    expect(await normalPreview.text()).toContain(
      '<title>Add Watch Title · WebVista</title>',
    )

    const invalid = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch`, {
        body: new URLSearchParams({
          title: 'Invalid',
          mediaType: 'movie',
          serviceName: 'Example',
          watchUrl: 'file:///private/movie',
        }),
        headers,
        method: 'POST',
      }),
    )
    expect(invalid.status).toBe(422)

    const created = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch`, {
        body: new URLSearchParams({
          title: 'Manual Title',
          year: '2025',
          mediaType: 'tv',
          posterUrl: 'https://images.example/manual.jpg',
          serviceName: 'Netflix',
          watchUrl: 'https://www.netflix.com/title/123',
          metadataId: 'tv/95396',
        }),
        headers,
        method: 'POST',
        redirect: 'manual',
      }),
    )
    expect(created.status).toBe(303)
    expect(created.headers.get('location')).toBe('/admin')
    await expect(listWatchItems(env.DB)).resolves.toMatchObject([
      { title: 'Manual Title', year: 2025, mediaType: 'tv', tmdbId: 95396 },
    ])
  })

  it('supports enhanced and normal edit and removal flows', async () => {
    const item = await createWatchItem(env.DB, {
      title: 'Editable Movie',
      year: '2024',
      mediaType: 'movie',
      serviceName: 'Plex',
      watchUrl: 'https://app.plex.tv/editable',
      metadataId: 'movie/550',
    })
    const otherItem = await createWatchItem(env.DB, {
      title: 'Other Movie',
      mediaType: 'movie',
      serviceName: 'Prime Video',
      watchUrl: 'https://www.amazon.com/video/other',
    })
    const cookie = await login()
    const headers = { Cookie: cookie, Origin: origin }
    const htmxHeaders = { ...headers, 'HX-Request': 'true' }

    const dashboard = await workerExports.default.fetch(
      new Request(`${origin}/admin`, { headers }),
    )
    const dashboardBody = await dashboard.text()
    expect(dashboardBody).toContain('data-admin-watch-list')
    expect(dashboardBody).toContain('data-admin-watch-row')
    expect(dashboardBody).toContain('data-move-watch="up"')
    expect(dashboardBody).toContain('id="watch-order-status"')
    expect(dashboardBody).toContain(`/admin/watch/${item.id}/edit`)
    expect(dashboardBody).toContain(`/admin/watch/${item.id}/delete`)

    const reordered = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/reorder`, {
        body: JSON.stringify({ ids: [item.id, otherItem.id] }),
        headers: { ...headers, 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    )
    expect(reordered.status).toBe(200)
    expect((await listWatchItems(env.DB)).map(({ id }) => id)).toEqual([
      item.id,
      otherItem.id,
    ])
    const reorderedPortalBody = await (
      await workerExports.default.fetch(`${origin}/`)
    ).text()
    expect(reorderedPortalBody.indexOf(item.id)).toBeLessThan(
      reorderedPortalBody.indexOf(otherItem.id),
    )

    const edit = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/${item.id}/edit`, {
        headers: htmxHeaders,
      }),
    )
    const editBody = await edit.text()
    expect(editBody).toContain('Edit Title')
    expect(editBody).toContain(`hx-post="/admin/watch/${item.id}"`)
    expect(editBody).toContain('name="presentation" value="dashboard"')
    expect(editBody).toContain('value="Editable Movie"')
    expect(editBody).not.toContain('<html')

    const invalid = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/${item.id}`, {
        body: new URLSearchParams({
          presentation: 'dashboard',
          title: '',
          mediaType: 'movie',
          serviceName: 'Plex',
          watchUrl: 'https://app.plex.tv/editable',
          enabled: '1',
        }),
        headers: htmxHeaders,
        method: 'POST',
      }),
    )
    expect(invalid.status).toBe(200)
    expect(await invalid.text()).toContain('Enter a title.')

    const saved = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/${item.id}`, {
        body: new URLSearchParams({
          presentation: 'dashboard',
          metadataId: 'tt11280740',
          title: 'Edited Show',
          year: '2025',
          mediaType: 'tv',
          posterUrl: 'https://images.example/show.jpg',
          serviceName: 'Netflix',
          watchUrl: 'https://www.netflix.com/title/123',
        }),
        headers: htmxHeaders,
        method: 'POST',
      }),
    )
    const savedBody = await saved.text()
    expect(savedBody).toContain('Edited Show</strong> was updated.')
    expect(savedBody).toContain('hx-swap-oob="outerHTML"')
    expect(savedBody).toContain('Hidden')
    await expect(getWatchItem(env.DB, item.id)).resolves.toMatchObject({
      title: 'Edited Show',
      enabled: false,
    })

    const portal = await workerExports.default.fetch(`${origin}/`)
    expect(await portal.text()).not.toContain(`data-watch-id="${item.id}"`)

    const remove = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/${item.id}/delete`, {
        headers: htmxHeaders,
      }),
    )
    expect(await remove.text()).toContain(`hx-delete="/admin/watch/${item.id}"`)

    const removed = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/${item.id}?confirmed=yes`, {
        headers: htmxHeaders,
        method: 'DELETE',
      }),
    )
    const removedBody = await removed.text()
    expect(removedBody).toContain('was removed.')
    expect(removedBody).toContain(`id="admin-watch-${item.id}" hx-swap-oob="delete"`)
    await expect(getWatchItem(env.DB, item.id)).resolves.toBeNull()

    const normalItem = await createWatchItem(env.DB, {
      title: 'Normal Form Movie',
      mediaType: 'movie',
      serviceName: 'Prime Video',
      watchUrl: 'https://www.amazon.com/video/normal',
    })
    const normalEdit = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/${normalItem.id}/edit`, { headers }),
    )
    expect(await normalEdit.text()).toContain('<title>Edit Watch Title · WebVista</title>')

    const normalSaved = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/${normalItem.id}`, {
        body: new URLSearchParams({
          title: 'Normal Form Updated',
          mediaType: 'movie',
          serviceName: 'Prime Video',
          watchUrl: 'https://www.amazon.com/video/updated',
          enabled: '1',
        }),
        headers,
        method: 'POST',
        redirect: 'manual',
      }),
    )
    expect(normalSaved.status).toBe(303)
    expect(normalSaved.headers.get('location')).toBe('/admin')

    const normalDelete = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/${normalItem.id}/delete`, { headers }),
    )
    expect(await normalDelete.text()).toContain('<title>Remove Watch Title · WebVista</title>')
    const normalRemoved = await workerExports.default.fetch(
      new Request(`${origin}/admin/watch/${normalItem.id}/delete`, {
        body: new URLSearchParams({ confirmed: 'yes' }),
        headers,
        method: 'POST',
        redirect: 'manual',
      }),
    )
    expect(normalRemoved.status).toBe(303)
    await expect(getWatchItem(env.DB, normalItem.id)).resolves.toBeNull()
  })

  it('protects the Watch write routes', async () => {
    for (const path of ['/admin/watch', '/admin/watch/reorder']) {
      const response = await workerExports.default.fetch(
        new Request(`${origin}${path}`, {
          body: new URLSearchParams(),
          headers: { Origin: origin },
          method: 'POST',
          redirect: 'manual',
        }),
      )
      expect(response.status).toBe(401)
      expect(response.headers.get('location')).toBeNull()
    }
  })
})
