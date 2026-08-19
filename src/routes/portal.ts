import { Hono } from 'hono'
import { listFavorites } from '../services/favorites'
import { isForYouVisible, listForYouItems } from '../services/for-you'
import { listWatchItems } from '../services/watch'
import {
  fetchWeather,
  fetchWeatherPlace,
  PORTLAND_97209_WEATHER_LOCATION,
} from '../services/weather'
import { renderPortal } from '../views/portal'
import {
  renderWeather,
  renderWeatherUnavailable,
} from '../views/partials/weather'

export const portalRoutes = new Hono<{ Bindings: CloudflareBindings }>()

portalRoutes.get('/', async (context) => {
  const [favorites, forYouItems, forYouVisible, watchItems] = await Promise.all([
    listFavorites(context.env.DB, { enabledOnly: true }),
    listForYouItems(context.env.DB, { enabledOnly: true }),
    isForYouVisible(context.env.DB),
    listWatchItems(context.env.DB, { enabledOnly: true }),
  ])
  return context.html(
    await renderPortal(
      favorites,
      forYouVisible ? forYouItems : [],
      watchItems,
    ),
  )
})

portalRoutes.get('/weather', async (context) => {
  try {
    const [weather, place] = await Promise.all([
      fetchWeather(PORTLAND_97209_WEATHER_LOCATION),
      fetchWeatherPlace(),
    ])
    context.header('Cache-Control', 'public, max-age=600')
    return context.html(await renderWeather(weather, place))
  } catch {
    context.header('Cache-Control', 'no-store')
    return context.html(await renderWeatherUnavailable(), 502)
  }
})
