import { Hono, type Context } from 'hono'
import {
  requireAdmin,
  requireSameOriginForWrites,
} from '../middleware/auth'
import {
  createFavorite,
  deleteFavorite,
  type Favorite,
  FavoriteReorderError,
  FavoriteValidationError,
  getFavorite,
  listFavorites,
  normalizeFavoriteTitle,
  normalizeFavoriteUrl,
  reorderFavorites,
  updateFavorite,
} from '../services/favorites'
import {
  deleteCustomIcon,
  IconUploadError,
  storeCustomIcon,
  validateCustomIcon,
} from '../services/icon-storage'
import { discoverSiteMetadata } from '../services/icons'
import {
  renderAdminAddPage,
  renderAdminDashboard,
  renderAdminDeletePage,
  renderAdminEditPage,
} from '../views/admin'
import {
  type AutomaticIconAction,
  type EditFavoriteFormValues,
  renderEditFavoriteForm,
  renderEditFavoriteSuccess,
} from '../views/partials/favorite-edit-form'
import {
  renderDeleteFavoriteConfirmation,
  renderDeleteFavoriteSuccess,
} from '../views/partials/favorite-delete'
import {
  type AddFavoriteFormValues,
  renderAddFavoriteForm,
  renderAddFavoriteSuccess,
  renderFavoriteIconPreview,
  renderFavoritePreviewError,
} from '../views/partials/favorite-form'

export const adminRoutes = new Hono<{ Bindings: CloudflareBindings }>()

adminRoutes.use('*', requireAdmin)
adminRoutes.use('*', requireSameOriginForWrites)

adminRoutes.get('/', async (context) => {
  context.header('Cache-Control', 'no-store')
  const favorites = await listFavorites(context.env.DB)
  return context.html(await renderAdminDashboard(favorites))
})

const isHtmxRequest = (request: { header(name: string): string | undefined }) =>
  request.header('HX-Request') === 'true'

const bodyString = (
  body: Record<string, string | File | (string | File)[]>,
  key: string,
): string => (typeof body[key] === 'string' ? body[key] : '')

const bodyFile = (
  body: Record<string, string | File | (string | File)[]>,
  key: string,
): File | null =>
  body[key] instanceof File && body[key].size > 0 ? body[key] : null

const formValues = (
  title: string,
  url: string,
  requestedIconMode: string,
): AddFavoriteFormValues => ({
  title,
  url,
  iconMode: ['auto', 'upload', 'fallback'].includes(requestedIconMode)
    ? (requestedIconMode as AddFavoriteFormValues['iconMode'])
    : 'auto',
})

const validateAddFavorite = (
  title: string,
  url: string,
  requestedIconMode: string,
): {
  errors: Record<string, string>
  normalizedTitle?: string
  normalizedUrl?: string
} => {
  const errors: Record<string, string> = {}
  let normalizedTitle: string | undefined
  let normalizedUrl: string | undefined

  try {
    normalizedTitle = normalizeFavoriteTitle(title)
  } catch (error) {
    if (error instanceof FavoriteValidationError) {
      Object.assign(errors, error.fieldErrors)
    } else {
      throw error
    }
  }

  try {
    normalizedUrl = normalizeFavoriteUrl(url)
  } catch (error) {
    if (error instanceof FavoriteValidationError) {
      Object.assign(errors, error.fieldErrors)
    } else {
      throw error
    }
  }

  if (!['auto', 'upload', 'fallback'].includes(requestedIconMode)) {
    errors.iconMode = 'Choose Automatic, Custom upload, or Generated fallback.'
  }

  return { errors, normalizedTitle, normalizedUrl }
}

adminRoutes.get('/favorites/new', async (context) => {
  const enhanced = isHtmxRequest(context.req)
  const form = await renderAddFavoriteForm({ enhanced })

  if (enhanced) {
    return context.html(form)
  }

  return context.html(await renderAdminAddPage(form))
})

adminRoutes.get('/favorites/icon-preview', async (context) => {
  const title = context.req.query('title') ?? ''
  const url = context.req.query('url') ?? ''
  const requestedIconMode = context.req.query('iconMode') ?? 'auto'

  if (requestedIconMode === 'upload') {
    return context.html(
      await renderFavoritePreviewError(
        'Choose a custom image above to preview it before saving.',
      ),
    )
  }

  let normalizedUrl: string

  try {
    normalizedUrl = normalizeFavoriteUrl(url)
  } catch (error) {
    const message =
      error instanceof FavoriteValidationError
        ? (error.fieldErrors.url ?? 'Enter a valid web or app address.')
        : 'Enter a valid web or app address.'
    return context.html(await renderFavoritePreviewError(message))
  }

  const values = formValues(title, normalizedUrl, requestedIconMode)
  const metadata =
    requestedIconMode === 'fallback'
      ? {
          pageUrl: normalizedUrl,
          title: null,
          icon: null,
          failure: null,
        }
      : await discoverSiteMetadata(normalizedUrl)

  return context.html(await renderFavoriteIconPreview(values, metadata))
})

adminRoutes.post('/favorites', async (context) => {
  const body = await context.req.parseBody()
  const title = bodyString(body, 'title')
  const url = bodyString(body, 'url')
  const requestedIconMode = bodyString(body, 'iconMode')
  const iconFile = bodyFile(body, 'iconFile')
  const enhanced =
    isHtmxRequest(context.req) && bodyString(body, 'presentation') === 'dashboard'
  const validation = validateAddFavorite(title, url, requestedIconMode)
  const values = formValues(title, url, requestedIconMode)

  if (requestedIconMode === 'upload') {
    if (!iconFile) {
      validation.errors.iconFile = 'Choose a PNG, JPEG, or WebP image.'
    } else {
      try {
        await validateCustomIcon(iconFile)
      } catch (error) {
        if (error instanceof IconUploadError) {
          validation.errors.iconFile = error.userMessage
        } else {
          throw error
        }
      }
    }
  }

  if (
    Object.keys(validation.errors).length > 0 ||
    !validation.normalizedTitle ||
    !validation.normalizedUrl
  ) {
    const form = await renderAddFavoriteForm({
      enhanced,
      errors: validation.errors,
      values,
    })

    if (enhanced) {
      return context.html(form)
    }

    return context.html(await renderAdminAddPage(form), 422)
  }

  const iconMode = requestedIconMode as AddFavoriteFormValues['iconMode']
  const metadata =
    iconMode === 'auto'
      ? await discoverSiteMetadata(validation.normalizedUrl)
      : null
  const totalAfterCreate = enhanced
    ? (await listFavorites(context.env.DB)).length + 1
    : null
  let iconStorageKey: string | null = null

  if (iconMode === 'upload' && iconFile) {
    try {
      iconStorageKey = await storeCustomIcon(context.env.ICONS, iconFile)
    } catch (error) {
      const message =
        error instanceof IconUploadError
          ? error.userMessage
          : 'The custom icon could not be stored. Try again.'
      const form = await renderAddFavoriteForm({
        enhanced,
        errors: { iconFile: message },
        values,
      })

      if (enhanced) {
        return context.html(form)
      }

      return context.html(await renderAdminAddPage(form), 422)
    }
  }

  try {
    const favorite = await createFavorite(context.env.DB, {
      title: validation.normalizedTitle,
      url: validation.normalizedUrl,
      iconMode,
      iconUrl: metadata?.icon?.url ?? null,
      iconStorageKey,
    })

    if (enhanced) {
      return context.html(
        await renderAddFavoriteSuccess(favorite, totalAfterCreate ?? 1),
      )
    }

    return context.redirect('/admin', 303)
  } catch (error) {
    try {
      await deleteCustomIcon(context.env.ICONS, iconStorageKey)
    } catch {
      // Preserve the original database failure if best-effort cleanup also fails.
    }

    if (!(error instanceof FavoriteValidationError)) {
      throw error
    }

    const form = await renderAddFavoriteForm({
      enhanced,
      errors: error.fieldErrors,
      values,
    })

    if (enhanced) {
      return context.html(form)
    }

    return context.html(await renderAdminAddPage(form), 422)
  }
})

adminRoutes.post('/favorites/reorder', async (context) => {
  let payload: unknown

  try {
    payload = await context.req.json()
  } catch {
    return context.json({ error: 'Send a valid JSON favorite order.' }, 400)
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('ids' in payload) ||
    !Array.isArray(payload.ids) ||
    payload.ids.some((id) => typeof id !== 'string' || id.length === 0)
  ) {
    return context.json(
      { error: 'Favorite order must be an array of IDs.' },
      400,
    )
  }

  try {
    await reorderFavorites(context.env.DB, payload.ids as string[])
    return context.json({ ok: true })
  } catch (error) {
    if (error instanceof FavoriteReorderError) {
      return context.json({ error: error.message }, 400)
    }

    throw error
  }
})

adminRoutes.get('/favorites/:id/edit', async (context) => {
  const favorite = await getFavorite(context.env.DB, context.req.param('id'))

  if (!favorite) {
    return context.notFound()
  }

  const enhanced = isHtmxRequest(context.req)
  const form = await renderEditFavoriteForm({ enhanced, favorite })

  if (enhanced) {
    return context.html(form)
  }

  return context.html(await renderAdminEditPage(form))
})

adminRoutes.post('/favorites/:id', async (context) => {
  const favorite = await getFavorite(context.env.DB, context.req.param('id'))

  if (!favorite) {
    return context.notFound()
  }

  const body = await context.req.parseBody()
  const title = bodyString(body, 'title')
  const url = bodyString(body, 'url')
  const requestedIconMode = bodyString(body, 'iconMode')
  const requestedAutomaticAction = bodyString(body, 'automaticIconAction')
  const iconFile = bodyFile(body, 'iconFile')
  const enabled = bodyString(body, 'enabled') === '1'
  const enhanced =
    isHtmxRequest(context.req) && bodyString(body, 'presentation') === 'dashboard'
  const validation = validateAddFavorite(title, url, requestedIconMode)
  const automaticIconAction: AutomaticIconAction =
    requestedAutomaticAction === 'keep' ? 'keep' : 'refresh'
  const values: EditFavoriteFormValues = {
    title,
    url,
    iconMode: formValues(title, url, requestedIconMode).iconMode,
    automaticIconAction,
    enabled,
  }

  if (!['keep', 'refresh'].includes(requestedAutomaticAction)) {
    validation.errors.automaticIconAction =
      'Choose whether to keep or refresh the automatic icon.'
  }

  if (requestedIconMode === 'upload') {
    if (!iconFile && !(favorite.iconMode === 'upload' && favorite.iconStorageKey)) {
      validation.errors.iconFile = 'Choose a PNG, JPEG, or WebP image.'
    } else if (iconFile) {
      try {
        await validateCustomIcon(iconFile)
      } catch (error) {
        if (error instanceof IconUploadError) {
          validation.errors.iconFile = error.userMessage
        } else {
          throw error
        }
      }
    }
  }

  const renderError = async (errors: Record<string, string>) => {
    const form = await renderEditFavoriteForm({
      enhanced,
      errors,
      favorite,
      values,
    })

    if (enhanced) {
      return context.html(form)
    }

    return context.html(await renderAdminEditPage(form), 422)
  }

  if (
    Object.keys(validation.errors).length > 0 ||
    !validation.normalizedTitle ||
    !validation.normalizedUrl
  ) {
    return renderError(validation.errors)
  }

  const iconMode = values.iconMode
  let iconUrl: string | null = null
  let iconStorageKey: string | null = null
  let newlyStoredKey: string | null = null

  if (iconMode === 'auto') {
    const mayKeepCurrent =
      automaticIconAction === 'keep' && favorite.iconMode === 'auto'

    if (mayKeepCurrent) {
      iconUrl = favorite.iconUrl
    } else {
      const metadata = await discoverSiteMetadata(validation.normalizedUrl)
      iconUrl = metadata.icon?.url ?? null
    }
  } else if (iconMode === 'upload') {
    if (iconFile) {
      try {
        newlyStoredKey = await storeCustomIcon(context.env.ICONS, iconFile)
        iconStorageKey = newlyStoredKey
      } catch (error) {
        const message =
          error instanceof IconUploadError
            ? error.userMessage
            : 'The custom icon could not be stored. Try again.'
        return renderError({ iconFile: message })
      }
    } else {
      iconStorageKey = favorite.iconStorageKey
    }
  }

  try {
    const updated = await updateFavorite(context.env.DB, favorite.id, {
      title: validation.normalizedTitle,
      url: validation.normalizedUrl,
      iconMode,
      iconUrl,
      iconStorageKey,
      enabled,
    })

    if (!updated) {
      await deleteCustomIcon(context.env.ICONS, newlyStoredKey)
      return context.notFound()
    }

    let cleanupFailed = false

    if (
      favorite.iconStorageKey &&
      favorite.iconStorageKey !== updated.iconStorageKey
    ) {
      try {
        await deleteCustomIcon(context.env.ICONS, favorite.iconStorageKey)
      } catch {
        cleanupFailed = true
      }
    }

    if (enhanced) {
      return context.html(
        await renderEditFavoriteSuccess(updated, cleanupFailed),
      )
    }

    if (cleanupFailed) {
      return context.html(
        await renderAdminEditPage(
          await renderEditFavoriteSuccess(updated, true, false),
        ),
      )
    }

    return context.redirect('/admin', 303)
  } catch (error) {
    try {
      await deleteCustomIcon(context.env.ICONS, newlyStoredKey)
    } catch {
      // Preserve the original database failure if best-effort cleanup also fails.
    }

    if (!(error instanceof FavoriteValidationError)) {
      throw error
    }

    return renderError(error.fieldErrors)
  }
})

type AdminContext = Context<{ Bindings: CloudflareBindings }>

const hasDeletionConfirmation = async (
  context: AdminContext,
): Promise<boolean> => {
  if (context.req.query('confirmed') === 'yes') {
    return true
  }

  const body = await context.req.parseBody()
  return bodyString(body, 'confirmed') === 'yes'
}

const deleteFavoriteAndRespond = async (
  context: AdminContext,
  favorite: Favorite,
  enhanced: boolean,
) => {
  const total = Math.max((await listFavorites(context.env.DB)).length - 1, 0)
  const deleted = await deleteFavorite(context.env.DB, favorite.id)

  if (!deleted) {
    return context.notFound()
  }

  let cleanupFailed = false

  try {
    await deleteCustomIcon(context.env.ICONS, favorite.iconStorageKey)
  } catch {
    cleanupFailed = true
  }

  const result = await renderDeleteFavoriteSuccess(
    favorite,
    total,
    cleanupFailed,
  )

  if (enhanced) {
    return context.html(result)
  }

  if (cleanupFailed) {
    return context.html(await renderAdminDeletePage(result))
  }

  return context.redirect('/admin', 303)
}

adminRoutes.get('/favorites/:id/delete', async (context) => {
  const favorite = await getFavorite(context.env.DB, context.req.param('id'))

  if (!favorite) {
    return context.notFound()
  }

  const enhanced = isHtmxRequest(context.req)
  const confirmation = await renderDeleteFavoriteConfirmation(
    favorite,
    enhanced,
  )

  if (enhanced) {
    return context.html(confirmation)
  }

  return context.html(await renderAdminDeletePage(confirmation))
})

adminRoutes.post('/favorites/:id/delete', async (context) => {
  if (!(await hasDeletionConfirmation(context))) {
    return context.text('Confirmation required.', 400)
  }

  const favorite = await getFavorite(context.env.DB, context.req.param('id'))

  if (!favorite) {
    return context.notFound()
  }

  return deleteFavoriteAndRespond(context, favorite, false)
})

adminRoutes.delete('/favorites/:id', async (context) => {
  if (!(await hasDeletionConfirmation(context))) {
    return context.text('Confirmation required.', 400)
  }

  const favorite = await getFavorite(context.env.DB, context.req.param('id'))

  if (!favorite) {
    return context.notFound()
  }

  return deleteFavoriteAndRespond(
    context,
    favorite,
    isHtmxRequest(context.req),
  )
})

adminRoutes.all('*', (context) => context.notFound())
