export const PORTLAND_97209_WEATHER_LOCATION = {
  latitude: 45.53,
  longitude: -122.68,
} as const

const WEATHER_RESPONSE_LIMIT = 64 * 1024
const WEATHER_TIMEOUT_MS = 4_000
const WEATHER_CACHE_SECONDS = 10 * 60

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export interface WeatherLocation {
  latitude: number
  longitude: number
}

export interface WeatherSnapshot {
  condition: string
  symbol: string
  temperature: number
  high: number
  low: number
}

export interface WeatherPlace {
  label: string
}

interface WeatherOptions {
  fetcher?: Fetcher
  timeoutMs?: number
}

export class WeatherError extends Error {
  constructor(
    public readonly code: 'invalid-response' | 'unavailable',
  ) {
    super(code)
    this.name = 'WeatherError'
  }
}

export const describeWeatherCode = (
  code: number,
): Pick<WeatherSnapshot, 'condition' | 'symbol'> => {
  if (code === 0) return { condition: 'Clear', symbol: '☀️' }
  if ([1, 2].includes(code)) return { condition: 'Partly cloudy', symbol: '🌤️' }
  if (code === 3) return { condition: 'Overcast', symbol: '☁️' }
  if ([45, 48].includes(code)) return { condition: 'Foggy', symbol: '🌫️' }
  if ([51, 53, 55, 56, 57].includes(code)) {
    return { condition: 'Drizzle', symbol: '🌦️' }
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { condition: 'Rain', symbol: '🌧️' }
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { condition: 'Snow', symbol: '🌨️' }
  }
  if ([95, 96, 99].includes(code)) {
    return { condition: 'Thunderstorms', symbol: '⛈️' }
  }
  return { condition: 'Mixed conditions', symbol: '🌥️' }
}

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const firstFiniteNumber = (value: unknown): number | null =>
  Array.isArray(value) ? finiteNumber(value[0]) : null

const parseWeatherResponse = (value: unknown): WeatherSnapshot => {
  if (!value || typeof value !== 'object') {
    throw new WeatherError('invalid-response')
  }

  const response = value as Record<string, unknown>
  const current = response.current
  const daily = response.daily
  if (!current || typeof current !== 'object' || !daily || typeof daily !== 'object') {
    throw new WeatherError('invalid-response')
  }

  const temperature = finiteNumber(
    (current as Record<string, unknown>).temperature_2m,
  )
  const weatherCode = finiteNumber(
    (current as Record<string, unknown>).weather_code,
  )
  const high = firstFiniteNumber(
    (daily as Record<string, unknown>).temperature_2m_max,
  )
  const low = firstFiniteNumber(
    (daily as Record<string, unknown>).temperature_2m_min,
  )

  if (temperature === null || weatherCode === null || high === null || low === null) {
    throw new WeatherError('invalid-response')
  }

  return {
    ...describeWeatherCode(weatherCode),
    temperature: Math.round(temperature),
    high: Math.round(high),
    low: Math.round(low),
  }
}

export const weatherApiUrl = (location: WeatherLocation): URL => {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', location.latitude.toFixed(2))
  url.searchParams.set('longitude', location.longitude.toFixed(2))
  url.searchParams.set('current', 'temperature_2m,weather_code')
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min')
  url.searchParams.set('temperature_unit', 'fahrenheit')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '1')
  return url
}

export const fetchWeatherPlace = async (): Promise<WeatherPlace> => ({
  label: 'Portland, Oregon',
})

export const fetchWeather = async (
  location: WeatherLocation,
  options: WeatherOptions = {},
): Promise<WeatherSnapshot> => {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? WEATHER_TIMEOUT_MS,
  )

  try {
    const response = await (options.fetcher ?? fetch)(weatherApiUrl(location), {
      cf: {
        cacheEverything: true,
        cacheTtl: WEATHER_CACHE_SECONDS,
      },
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) {
      await response.body?.cancel()
      throw new WeatherError('unavailable')
    }

    if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel()
      throw new WeatherError('invalid-response')
    }

    const declaredLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > WEATHER_RESPONSE_LIMIT) {
      await response.body?.cancel()
      throw new WeatherError('invalid-response')
    }

    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > WEATHER_RESPONSE_LIMIT) {
      throw new WeatherError('invalid-response')
    }

    return parseWeatherResponse(JSON.parse(text))
  } catch (error) {
    if (error instanceof WeatherError) throw error
    throw new WeatherError('unavailable')
  } finally {
    clearTimeout(timeout)
  }
}
