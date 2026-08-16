import { Hono } from 'hono'
import {
  requireAdmin,
  requireSameOriginForWrites,
} from '../middleware/auth'
import {
  createFavorite,
  FavoriteValidationError,
  listFavorites,
  normalizeFavoriteTitle,
  normalizeFavoriteUrl,
} from '../services/favorites'
import { discoverSiteMetadata } from '../services/icons'
import { renderAdminAddPage, renderAdminDashboard } from '../views/admin'
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

const formValues = (
  title: string,
  url: string,
  requestedIconMode: string,
): AddFavoriteFormValues => ({
  title,
  url,
  iconMode: requestedIconMode === 'fallback' ? 'fallback' : 'auto',
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

  if (!['auto', 'fallback'].includes(requestedIconMode)) {
    errors.iconMode = 'Choose Automatic or Generated fallback.'
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
  let normalizedUrl: string

  try {
    normalizedUrl = normalizeFavoriteUrl(url)
  } catch (error) {
    const message =
      error instanceof FavoriteValidationError
        ? (error.fieldErrors.url ?? 'Enter a valid web address.')
        : 'Enter a valid web address.'
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
  const enhanced =
    isHtmxRequest(context.req) && bodyString(body, 'presentation') === 'dashboard'
  const validation = validateAddFavorite(title, url, requestedIconMode)
  const values = formValues(title, url, requestedIconMode)

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

  const iconMode = requestedIconMode === 'fallback' ? 'fallback' : 'auto'
  const metadata =
    iconMode === 'auto'
      ? await discoverSiteMetadata(validation.normalizedUrl)
      : null

  try {
    const favorite = await createFavorite(context.env.DB, {
      title: validation.normalizedTitle,
      url: validation.normalizedUrl,
      iconMode,
      iconUrl: metadata?.icon?.url ?? null,
    })

    if (enhanced) {
      const favorites = await listFavorites(context.env.DB)
      return context.html(
        await renderAddFavoriteSuccess(favorite, favorites.length),
      )
    }

    return context.redirect('/admin', 303)
  } catch (error) {
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

adminRoutes.all('*', (context) => context.notFound())
