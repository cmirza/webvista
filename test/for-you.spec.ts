import { env, exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { createForYouBookmarklet } from '../src/services/bookmarklet'
import {
  createForYouItem,
  deleteForYouItem,
  ForYouReorderError,
  getForYouItem,
  isForYouVisible,
  listForYouItems,
  reorderForYouItems,
  setForYouVisible,
  updateForYouItem,
} from '../src/services/for-you'
import { renderForYouForm } from '../src/views/partials/for-you-form'

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

describe('For You items', () => {
  it('stores items in spaced order and filters disabled items', async () => {
    const first = await createForYouItem(env.DB, {
      url: 'https://news.example/story',
      title: 'A useful story',
      description: 'A short summary.',
      imageUrl: 'https://news.example/story.jpg',
      sourceName: 'Example News',
    })
    const hidden = await createForYouItem(env.DB, {
      url: 'https://video.example/watch',
      title: 'Hidden video',
      sourceName: 'Example Video',
      enabled: false,
    })

    expect(first.position).toBe(10)
    expect(hidden.position).toBe(10)
    const ordered = await listForYouItems(env.DB)
    expect(ordered.map(({ title, position }) => ({ title, position }))).toEqual([
      { title: 'Hidden video', position: 10 },
      { title: 'A useful story', position: 20 },
    ])
    await expect(listForYouItems(env.DB, { enabledOnly: true })).resolves.toMatchObject([
      { id: first.id, position: 20 },
    ])
    await expect(deleteForYouItem(env.DB, first.id)).resolves.toBe(true)
  })

  it('rejects unsafe links and image addresses', async () => {
    await expect(
      createForYouItem(env.DB, {
        url: 'http://127.0.0.1/private',
        title: 'Private',
        sourceName: 'Private',
      }),
    ).rejects.toMatchObject({ fieldErrors: { url: expect.any(String) } })

    await expect(
      createForYouItem(env.DB, {
        url: 'https://example.com/story',
        title: 'Story',
        sourceName: 'Example',
        imageUrl: 'javascript:alert(1)',
      }),
    ).rejects.toMatchObject({ fieldErrors: { imageUrl: expect.any(String) } })
  })

  it('updates links and persists only complete authoritative orders', async () => {
    const first = await createForYouItem(env.DB, {
      url: 'https://example.com/first',
      title: 'First',
      sourceName: 'Example',
    })
    const second = await createForYouItem(env.DB, {
      url: 'https://example.com/second',
      title: 'Second',
      sourceName: 'Example',
    })
    const third = await createForYouItem(env.DB, {
      url: 'https://example.com/third',
      title: 'Third',
      sourceName: 'Example',
    })
    const secondPosition = (await getForYouItem(env.DB, second.id))!.position

    const updated = await updateForYouItem(env.DB, second.id, {
      url: 'https://news.example/updated#section',
      title: 'Updated second',
      description: 'Updated summary',
      imageUrl: 'https://news.example/updated.jpg',
      sourceName: 'Updated News',
      enabled: false,
    })
    expect(updated).toMatchObject({
      id: second.id,
      position: secondPosition,
      url: 'https://news.example/updated',
      title: 'Updated second',
      enabled: false,
    })

    const reordered = await reorderForYouItems(env.DB, [
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
      reorderForYouItems(env.DB, [first.id, first.id, second.id]),
    ).rejects.toThrow(ForYouReorderError)
    await expect(
      reorderForYouItems(env.DB, [first.id, second.id]),
    ).rejects.toThrow(ForYouReorderError)
    await expect(
      reorderForYouItems(env.DB, [first.id, third.id, 'missing']),
    ).rejects.toThrow(ForYouReorderError)
    await expect(getForYouItem(env.DB, second.id)).resolves.toMatchObject({
      title: 'Updated second',
    })
  })

  it('renders enabled items as a single-row progressive carousel', async () => {
    const shown = await createForYouItem(env.DB, {
      url: 'https://news.example/story',
      title: 'Carousel story',
      description: 'Readable summary',
      imageUrl: 'https://news.example/story.jpg',
      sourceName: 'Example News',
    })
    const hidden = await createForYouItem(env.DB, {
      url: 'https://hidden.example/story',
      title: 'Hidden story',
      sourceName: 'Hidden News',
      enabled: false,
    })
    const response = await workerExports.default.fetch(`${origin}/`)
    const body = await response.text()

    expect(body).toContain('data-for-you-carousel')
    expect(body).toContain('class="for-you-track"')
    expect(body).toContain('data-carousel-control="previous"')
    expect(body).toContain('data-carousel-control="next"')
    expect(body).toContain(`data-for-you-id="${shown.id}"`)
    expect(body).toContain('Carousel story')
    expect(body).toContain('referrerpolicy="no-referrer"')
    expect(body).not.toContain(hidden.id)
    expect(body).not.toContain('target="_blank"')
  })

  it('provides authenticated add, validation, and removal flows', async () => {
    const cookie = await login()
    const headers = { Cookie: cookie, Origin: origin }
    const addPage = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/new`, { headers }),
    )
    const addBody = await addPage.text()

    expect(addPage.status).toBe(200)
    expect(addBody).toContain('action="/admin/for-you"')
    expect(addBody).toContain('formaction="/admin/for-you/preview"')
    expect(addBody).toContain('formnovalidate')

    const invalid = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you`, {
        body: new URLSearchParams({
          url: 'javascript:alert(1)',
          title: 'Invalid',
          sourceName: 'Invalid',
        }),
        headers,
        method: 'POST',
      }),
    )
    expect(invalid.status).toBe(422)

    const created = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you`, {
        body: new URLSearchParams({
          url: 'https://news.example/story#section',
          title: 'Manual headline',
          description: 'Manual summary',
          imageUrl: 'https://news.example/story.jpg',
          sourceName: 'Manual News',
        }),
        headers,
        method: 'POST',
        redirect: 'manual',
      }),
    )
    expect(created.status).toBe(303)
    expect(created.headers.get('location')).toBe('/admin')

    const [item] = await listForYouItems(env.DB)
    expect(item).toMatchObject({
      url: 'https://news.example/story',
      title: 'Manual headline',
      sourceName: 'Manual News',
    })

    const confirmation = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/${item.id}/delete`, { headers }),
    )
    expect(await confirmation.text()).toContain('Remove Link?')

    const removed = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/${item.id}/delete`, {
        body: new URLSearchParams({ confirmed: 'yes' }),
        headers,
        method: 'POST',
        redirect: 'manual',
      }),
    )
    expect(removed.status).toBe(303)
    await expect(listForYouItems(env.DB)).resolves.toEqual([])
  })

  it('keeps the enhanced Add Link workflow inside the dashboard workspace', async () => {
    const cookie = await login()
    const headers = {
      Cookie: cookie,
      Origin: origin,
      'HX-Request': 'true',
    }

    const addFragment = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/new`, { headers }),
    )
    const addBody = await addFragment.text()
    expect(addFragment.status).toBe(200)
    expect(addBody).toContain('id="for-you-form-shell"')
    expect(addBody).toContain('hx-post="/admin/for-you"')
    expect(addBody).toContain('hx-get="/admin/for-you/preview"')
    expect(addBody).toContain('hx-include="closest form"')
    const previewButton = addBody.match(
      /<button[^>]*data-for-you-preview-button[^>]*>/,
    )?.[0]
    expect(previewButton).toBeDefined()
    expect(previewButton).not.toContain('btn-lg')
    expect(addBody).not.toContain('<html')
    expect(addBody).not.toContain('Admin Panel')

    const previewQuery = new URLSearchParams({
      capture: 'browser',
      url: 'https://news.example/dashboard-story',
      title: 'Dashboard preview',
      sourceName: 'Example News',
    })
    const preview = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/preview?${previewQuery}`, {
        headers,
      }),
    )
    const previewBody = await preview.text()
    expect(preview.status).toBe(200)
    expect(previewBody).toContain('captured from the open page in your browser')
    expect(previewBody).toContain('hx-post="/admin/for-you"')
    expect(previewBody).not.toContain('<html')

    const invalid = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you`, {
        body: new URLSearchParams({
          presentation: 'dashboard',
          url: 'javascript:alert(1)',
          title: 'Invalid',
          sourceName: 'Example News',
        }),
        headers,
        method: 'POST',
      }),
    )
    expect(invalid.status).toBe(200)
    expect(await invalid.text()).not.toContain('<html')

    const created = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you`, {
        body: new URLSearchParams({
          presentation: 'dashboard',
          url: 'https://news.example/dashboard-story',
          title: 'Dashboard story',
          sourceName: 'Example News',
        }),
        headers,
        method: 'POST',
      }),
    )
    const createdBody = await created.text()
    expect(created.status).toBe(200)
    expect(createdBody).toContain('was added to For You')
    expect(createdBody).toContain('data-auto-dismiss="4500"')
    expect(createdBody).toContain(
      'hx-swap-oob="afterbegin:#admin-for-you-list"',
    )
    expect(createdBody).not.toContain('<html')
    await expect(listForYouItems(env.DB)).resolves.toMatchObject([
      { title: 'Dashboard story' },
    ])
  })

  it('provides HTMX editing, ordering, and removal controls', async () => {
    const older = await createForYouItem(env.DB, {
      url: 'https://example.com/older',
      title: 'Older story',
      sourceName: 'Example',
    })
    const newer = await createForYouItem(env.DB, {
      url: 'https://example.com/newer',
      title: 'Newer story',
      sourceName: 'Example',
    })
    const cookie = await login()
    const headers = { Cookie: cookie, Origin: origin }

    const dashboard = await workerExports.default.fetch(
      new Request(`${origin}/admin`, { headers }),
    )
    const dashboardBody = await dashboard.text()
    expect(dashboardBody).toContain('data-admin-for-you-list')
    expect(dashboardBody).toContain(`data-for-you-id="${newer.id}"`)
    expect(dashboardBody).toContain('data-move-for-you="up"')
    expect(dashboardBody).toContain(`/admin/for-you/${newer.id}/edit`)
    expect(dashboardBody).toContain('id="for-you-order-status"')

    const editFragment = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/${newer.id}/edit`, {
        headers: { ...headers, 'HX-Request': 'true' },
      }),
    )
    const editBody = await editFragment.text()
    expect(editFragment.status).toBe(200)
    expect(editBody).toContain('Edit Link')
    expect(editBody).toContain(`hx-post="/admin/for-you/${newer.id}"`)
    expect(editBody).toContain('name="presentation" value="dashboard"')
    expect(editBody).toContain('Newer story')

    const invalidEdit = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/${newer.id}`, {
        body: new URLSearchParams({
          presentation: 'dashboard',
          url: 'https://example.com/newer',
          title: '',
          sourceName: 'Entered source',
        }),
        headers: { ...headers, 'HX-Request': 'true' },
        method: 'POST',
      }),
    )
    const invalidBody = await invalidEdit.text()
    expect(invalidEdit.status).toBe(200)
    expect(invalidBody).toContain('Enter a title.')
    expect(invalidBody).toContain('value="Entered source"')

    const updated = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/${newer.id}`, {
        body: new URLSearchParams({
          presentation: 'dashboard',
          url: 'https://news.example/updated',
          title: 'Edited story',
          sourceName: 'Edited News',
          description: 'Edited description',
          enabled: '1',
        }),
        headers: { ...headers, 'HX-Request': 'true' },
        method: 'POST',
      }),
    )
    const updatedBody = await updated.text()
    expect(updated.status).toBe(200)
    expect(updatedBody).toContain('Edited story</strong> was updated')
    expect(updatedBody).toContain('hx-swap-oob="outerHTML"')
    await expect(getForYouItem(env.DB, newer.id)).resolves.toMatchObject({
      title: 'Edited story',
      enabled: true,
    })

    const reordered = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/reorder`, {
        body: JSON.stringify({ ids: [older.id, newer.id] }),
        headers: { ...headers, 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    )
    expect(reordered.status).toBe(200)
    expect((await listForYouItems(env.DB)).map(({ id }) => id)).toEqual([
      older.id,
      newer.id,
    ])

    const confirmation = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/${older.id}/delete`, {
        headers: { ...headers, 'HX-Request': 'true' },
      }),
    )
    expect(await confirmation.text()).toContain(
      `hx-delete="/admin/for-you/${older.id}"`,
    )

    const removed = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/${older.id}?confirmed=yes&presentation=dashboard`, {
        headers: { ...headers, 'HX-Request': 'true' },
        method: 'DELETE',
      }),
    )
    const removedBody = await removed.text()
    expect(removed.status).toBe(200)
    expect(removedBody).toContain(`id="admin-for-you-${older.id}"`)
    expect(removedBody).toContain('hx-swap-oob="delete"')
    await expect(getForYouItem(env.DB, older.id)).resolves.toBeNull()
  })

  it('protects the For You write endpoints', async () => {
    for (const path of [
      '/admin/for-you',
      '/admin/for-you/visibility',
      '/admin/for-you/missing/delete',
    ]) {
      const response = await workerExports.default.fetch(
        new Request(`${origin}${path}`, {
          body: new URLSearchParams(),
          headers: { Origin: origin },
          method: 'POST',
        }),
      )
      expect(response.status).toBe(401)
    }
  })

  it('persists portal visibility without deleting links', async () => {
    const item = await createForYouItem(env.DB, {
      url: 'https://news.example/story',
      title: 'Saved while hidden',
      sourceName: 'Example News',
    })
    const cookie = await login()
    const headers = { Cookie: cookie, Origin: origin }
    const dashboard = await workerExports.default.fetch(
      new Request(`${origin}/admin`, { headers }),
    )
    const dashboardBody = await dashboard.text()
    const forYouHeadingIndex = dashboardBody.indexOf('>For You</h2>')
    const visibilityFormIndex = dashboardBody.indexOf(
      'action="/admin/for-you/visibility"',
    )

    expect(forYouHeadingIndex).toBeGreaterThan(-1)
    expect(visibilityFormIndex).toBeGreaterThan(forYouHeadingIndex)
    expect(dashboardBody).toContain('hx-trigger="change"')
    expect(dashboardBody).not.toContain('Save Visibility')

    const hidden = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/visibility`, {
        body: new URLSearchParams(),
        headers,
        method: 'POST',
        redirect: 'manual',
      }),
    )

    expect(hidden.status).toBe(303)
    await expect(isForYouVisible(env.DB)).resolves.toBe(false)
    await expect(listForYouItems(env.DB)).resolves.toEqual([item])
    expect(await (await workerExports.default.fetch(`${origin}/`)).text()).not.toContain(
      'data-for-you-carousel',
    )

    const shownWithHtmx = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/visibility`, {
        body: new URLSearchParams({ enabled: '1' }),
        headers: { ...headers, 'HX-Request': 'true' },
        method: 'POST',
      }),
    )
    expect(shownWithHtmx.status).toBe(200)
    await expect(shownWithHtmx.text()).resolves.toBe('Shown on portal.')
    await expect(isForYouVisible(env.DB)).resolves.toBe(true)

    await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/visibility`, {
        body: new URLSearchParams({ enabled: '1' }),
        headers,
        method: 'POST',
      }),
    )
    await expect(isForYouVisible(env.DB)).resolves.toBe(true)
    expect(await (await workerExports.default.fetch(`${origin}/`)).text()).toContain(
      `data-for-you-id="${item.id}"`,
    )
  })

  it('explains when preview selected a verified AMP address', async () => {
    const form = await renderForYouForm({
      metadataNotice: 'A verified reader-friendly AMP version is available.',
      values: { url: 'https://publisher.example/story/amp/' },
    })

    expect(form.toString()).toContain('alert-info')
    expect(form.toString()).toContain('reader-friendly AMP version')
  })

  it('creates a same-origin bookmarklet that captures standard preview metadata', () => {
    const bookmarklet = createForYouBookmarklet(origin)

    expect(bookmarklet).toMatch(/^javascript:/)
    expect(bookmarklet).toContain(`${origin}/admin/for-you/preview`)
    expect(bookmarklet).toContain('capture:"browser"')
    expect(bookmarklet).toContain('og:title')
    expect(bookmarklet).toContain('twitter:title')
    expect(bookmarklet).toContain('og:image')
    expect(bookmarklet).not.toContain('document.cookie')
    expect(bookmarklet).not.toContain('document.body')
    expect(() => createForYouBookmarklet(`${origin}/admin`)).toThrow()
    expect(() => createForYouBookmarklet('javascript:alert(1)')).toThrow()
  })

  it('renders the authenticated bookmarklet installer', async () => {
    const cookie = await login()
    const response = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/bookmarklet`, {
        headers: { Cookie: cookie },
      }),
    )
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Install Bookmarklet')
    expect(body).toContain('Add to WebVista')
    expect(body).toContain('id="bookmarklet-code"')
    expect(body).toContain('href="javascript:')
    expect(body).toContain('/admin/for-you/preview')
    expect(body).toContain('iPhone or iPad')
  })

  it('opens a captured editable preview without publisher retrieval', async () => {
    const cookie = await login()
    const query = new URLSearchParams({
      capture: 'browser',
      url: 'https://blocked.example/story',
      title: 'Captured headline',
      description: 'Captured summary',
      imageUrl: 'https://blocked.example/image.jpg',
      sourceName: 'Blocked News',
    })
    const response = await workerExports.default.fetch(
      new Request(`${origin}/admin/for-you/preview?${query}`, {
        headers: { Cookie: cookie },
      }),
    )
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('captured from the open page in your browser')
    expect(body).toContain('value="Captured headline"')
    expect(body).toContain('Captured summary')
    expect(body).toContain('value="Blocked News"')
    expect(body).toContain('action="/admin/for-you"')
    expect(body).not.toContain('publisher blocked automatic preview details')
  })

  it('supports direct visibility service changes', async () => {
    await setForYouVisible(env.DB, false)
    await expect(isForYouVisible(env.DB)).resolves.toBe(false)
    await setForYouVisible(env.DB, true)
    await expect(isForYouVisible(env.DB)).resolves.toBe(true)
  })
})
