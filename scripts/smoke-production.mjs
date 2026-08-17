import { readFile } from 'node:fs/promises'

const baseUrl = process.argv[2]?.replace(/\/$/, '')

if (!baseUrl || !baseUrl.startsWith('https://')) {
  throw new Error('Pass the deployed HTTPS origin as the first argument.')
}

const envText = await readFile(new URL('../.dev.vars', import.meta.url), 'utf8')

function readLocalSecret(name) {
  const match = new RegExp(`^${name}=(.*)$`, 'm').exec(envText)
  if (!match) {
    throw new Error(`${name} is missing from .dev.vars.`)
  }

  const value = match[1].trim()
  if (value.startsWith('"') && value.endsWith('"')) {
    return JSON.parse(value)
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1)
  }
  return value
}

const password = readLocalSecret('ADMIN_PASSWORD')
const testSuffix = `${Date.now()}-${crypto.randomUUID()}`
const testTitle = `WebVista deployment check ${testSuffix}`
const testUrl = `weather://deployment-check-${testSuffix}`
const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
])

let cookie = ''
let favoriteId = ''
let originalIds = []

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers)
  if (cookie) {
    headers.set('Cookie', cookie)
  }
  if (init.method && !['GET', 'HEAD'].includes(init.method)) {
    headers.set('Origin', baseUrl)
  }

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    redirect: 'manual',
  })
}

function favoriteIds(html) {
  return [...html.matchAll(/data-favorite-id="([^"]+)"/g)].map(
    ([, id]) => id,
  )
}

async function deleteTemporaryFavorite() {
  if (!favoriteId) {
    return
  }

  const response = await request(`/admin/favorites/${favoriteId}/delete`, {
    body: new URLSearchParams({ confirmed: 'yes' }),
    method: 'POST',
  })
  assert(response.status === 303 || response.status === 404, 'Cleanup failed.')
  favoriteId = ''
}

try {
  const portal = await request('/')
  const portalHtml = await portal.text()
  assert(portal.status === 200, 'The public portal did not return 200.')
  assert(
    portalHtml.includes('https://www.google.com/search'),
    'The Google search form is missing.',
  )

  const css = await request('/assets/app.css')
  assert(css.status === 200, 'The production stylesheet is unavailable.')
  assert(
    css.headers.get('content-type')?.includes('text/css'),
    'The stylesheet has the wrong content type.',
  )

  const protectedPage = await request('/admin')
  assert(
    protectedPage.status === 303 &&
      protectedPage.headers.get('location') === '/admin/login',
    'The admin page is not redirecting unauthenticated visitors.',
  )

  const protectedWrite = await request('/admin/favorites', {
    body: new URLSearchParams(),
    method: 'POST',
  })
  assert(protectedWrite.status === 401, 'An unauthenticated write was accepted.')

  const login = await request('/admin/login', {
    body: new URLSearchParams({ password }),
    method: 'POST',
  })
  assert(login.status === 303, 'Production admin login failed.')
  const setCookie = login.headers.getSetCookie?.()[0] ?? login.headers.get('set-cookie')
  assert(setCookie, 'Production login did not set a session cookie.')
  cookie = setCookie.split(';', 1)[0]

  const initialAdmin = await request('/admin')
  const initialAdminHtml = await initialAdmin.text()
  assert(initialAdmin.status === 200, 'Authenticated admin page failed.')
  originalIds = favoriteIds(initialAdminHtml)

  const create = await request('/admin/favorites', {
    body: new URLSearchParams({
      title: testTitle,
      url: testUrl,
      iconMode: 'fallback',
    }),
    method: 'POST',
  })
  assert(create.status === 303, 'Creating the temporary favorite failed.')

  const createdAdmin = await request('/admin')
  const createdHtml = await createdAdmin.text()
  const idsAfterCreate = favoriteIds(createdHtml)
  favoriteId = idsAfterCreate.find((id) => !originalIds.includes(id)) ?? ''
  assert(favoriteId, 'The temporary favorite could not be identified.')
  assert(createdHtml.includes(testTitle), 'The temporary favorite is not listed.')

  const reorderedIds = [favoriteId, ...originalIds]
  const reorder = await request('/admin/favorites/reorder', {
    body: JSON.stringify({ ids: reorderedIds }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  assert(reorder.status === 200, 'Reordering favorites failed.')

  const restoreOrder = await request('/admin/favorites/reorder', {
    body: JSON.stringify({ ids: [...originalIds, favoriteId] }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  assert(restoreOrder.status === 200, 'Restoring the favorite order failed.')

  const uploadForm = new FormData()
  uploadForm.set('title', testTitle)
  uploadForm.set('url', testUrl)
  uploadForm.set('iconMode', 'upload')
  uploadForm.set('automaticIconAction', 'refresh')
  uploadForm.set('enabled', '1')
  uploadForm.set(
    'iconFile',
    new File([pngBytes], 'deployment-check.png', { type: 'image/png' }),
  )

  const update = await request(`/admin/favorites/${favoriteId}`, {
    body: uploadForm,
    method: 'POST',
  })
  assert(update.status === 303, 'Updating the temporary favorite failed.')

  const editPage = await request(`/admin/favorites/${favoriteId}/edit`)
  const editHtml = await editPage.text()
  const iconPath = /src="(\/icons\/[^"]+\.png)"/.exec(editHtml)?.[1]
  assert(iconPath, 'The uploaded icon is not referenced by the favorite.')

  const icon = await request(iconPath)
  assert(icon.status === 200, 'The uploaded R2 icon is unavailable.')
  assert(
    icon.headers.get('content-type') === 'image/png',
    'The uploaded icon has the wrong content type.',
  )

  await deleteTemporaryFavorite()

  const finalAdmin = await request('/admin')
  const finalHtml = await finalAdmin.text()
  assert(!finalHtml.includes(testTitle), 'Temporary test data remains in D1.')
  assert(
    JSON.stringify(favoriteIds(finalHtml)) === JSON.stringify(originalIds),
    'The original favorite order was not preserved.',
  )

  const deletedIcon = await request(iconPath)
  assert(deletedIcon.status === 404, 'The temporary R2 icon was not removed.')

  const logout = await request('/admin/logout', {
    body: new URLSearchParams(),
    method: 'POST',
  })
  assert(logout.status === 303, 'Production logout failed.')

  console.log(`Production smoke test passed: ${baseUrl}`)
} catch (error) {
  try {
    await deleteTemporaryFavorite()
  } catch (cleanupError) {
    console.error(cleanupError instanceof Error ? cleanupError.message : cleanupError)
  }
  throw error
}
