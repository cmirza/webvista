import { exports as workerExports } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  describeWeatherCode,
  fetchWeather,
  fetchWeatherPlace,
  locationApiUrl,
  PORTLAND_WEATHER_LOCATION,
  WeatherError,
  weatherApiUrl,
  weatherLocationFromSearch,
} from '../src/services/weather'

const weatherResponse = () =>
  new Response(
    JSON.stringify({
      current: {
        temperature_2m: 67.6,
        weather_code: 2,
      },
      daily: {
        temperature_2m_max: [74.4],
        temperature_2m_min: [55.2],
      },
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  )

const locationResponse = () =>
  new Response(
    JSON.stringify({
      address: {
        city: 'Portland',
        state: 'Oregon',
        country: 'United States',
      },
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  )

afterEach(() => vi.restoreAllMocks())

describe('weather', () => {
  it('uses Portland when browser coordinates are absent', () => {
    expect(weatherLocationFromSearch(new URLSearchParams())).toEqual({
      ...PORTLAND_WEATHER_LOCATION,
      source: 'portland',
    })
  })

  it('validates and rounds browser coordinates to a coarse location', () => {
    expect(
      weatherLocationFromSearch(
        new URLSearchParams({
          latitude: '45.52345',
          longitude: '-122.67621',
        }),
      ),
    ).toEqual({ latitude: 45.52, longitude: -122.68, source: 'browser' })

    for (const query of [
      [['latitude', '91'], ['longitude', '0']],
      [['latitude', '45']],
      [['latitude', 'not-a-number'], ['longitude', '-122']],
    ]) {
      expect(() =>
        weatherLocationFromSearch(new URLSearchParams(query)),
      ).toThrowError(WeatherError)
    }
  })

  it('requests current conditions and one-day Fahrenheit high and low', () => {
    const url = weatherApiUrl({
      latitude: 45.52,
      longitude: -122.68,
      source: 'portland',
    })

    expect(url.origin).toBe('https://api.open-meteo.com')
    expect(url.searchParams.get('current')).toBe('temperature_2m,weather_code')
    expect(url.searchParams.get('daily')).toBe(
      'temperature_2m_max,temperature_2m_min',
    )
    expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit')
    expect(url.searchParams.get('timezone')).toBe('auto')
    expect(url.searchParams.get('forecast_days')).toBe('1')
  })

  it('reverse-geocodes coarse browser coordinates into a locality label', async () => {
    const location = {
      latitude: 45.52,
      longitude: -122.68,
      source: 'browser' as const,
    }
    const url = locationApiUrl(location)
    const fetcher = vi.fn(async () => locationResponse())

    expect(url.origin).toBe('https://nominatim.openstreetmap.org')
    expect(url.searchParams.get('lat')).toBe('45.52')
    expect(url.searchParams.get('lon')).toBe('-122.68')
    expect(url.searchParams.get('zoom')).toBe('10')
    await expect(fetchWeatherPlace(location, { fetcher })).resolves.toEqual({
      label: 'Portland, Oregon',
    })
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        cf: { cacheEverything: true, cacheTtl: 86400 },
        headers: expect.objectContaining({
          'User-Agent': expect.stringContaining('WebVista'),
        }),
      }),
    )
  })

  it('uses the fixed Portland label without a reverse-geocoding request', async () => {
    const fetcher = vi.fn()
    await expect(
      fetchWeatherPlace(
        { ...PORTLAND_WEATHER_LOCATION, source: 'portland' },
        { fetcher },
      ),
    ).resolves.toEqual({
      label: 'Portland, Oregon',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('returns a compact, human-readable weather snapshot', async () => {
    const fetcher = vi.fn(async () => weatherResponse())

    await expect(
      fetchWeather(
        { latitude: 45.52, longitude: -122.68, source: 'portland' },
        { fetcher },
      ),
    ).resolves.toEqual({
      condition: 'Partly cloudy',
      symbol: '🌤️',
      temperature: 68,
      high: 74,
      low: 55,
    })
    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        href: expect.stringContaining('latitude=45.52'),
      }),
      expect.objectContaining({
        cf: { cacheEverything: true, cacheTtl: 600 },
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('maps documented weather-code groups to clear conditions', () => {
    expect(describeWeatherCode(0)).toEqual({ condition: 'Clear', symbol: '☀️' })
    expect(describeWeatherCode(48).condition).toBe('Foggy')
    expect(describeWeatherCode(63).condition).toBe('Rain')
    expect(describeWeatherCode(75).condition).toBe('Snow')
    expect(describeWeatherCode(95).condition).toBe('Thunderstorms')
  })

  it('rejects malformed or oversized provider responses', async () => {
    await expect(
      fetchWeather(
        { latitude: 45.52, longitude: -122.68, source: 'portland' },
        {
          fetcher: async () =>
            new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
        },
      ),
    ).rejects.toMatchObject({ code: 'invalid-response' })

    await expect(
      fetchWeather(
        { latitude: 45.52, longitude: -122.68, source: 'portland' },
        {
          fetcher: async () =>
            new Response('{}', {
              headers: {
                'Content-Length': String(65 * 1024),
                'Content-Type': 'application/json',
              },
            }),
        },
      ),
    ).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('serves the weather fragment and identifies its location source', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).includes('nominatim.openstreetmap.org')
        ? locationResponse()
        : weatherResponse(),
    )

    const local = await workerExports.default.fetch(
      'https://webvista.test/weather?latitude=45.523&longitude=-122.676',
    )
    const localBody = await local.text()
    expect(local.status).toBe(200)
    expect(local.headers.get('cache-control')).toBe('public, max-age=600')
    expect(localBody).toContain('data-weather-result')
    expect(localBody).toContain('Portland, Oregon')
    expect(localBody).not.toContain('© OpenStreetMap')
    expect(localBody).not.toContain('Your location')
    expect(localBody).not.toContain('<html')

    const portland = await workerExports.default.fetch(
      'https://webvista.test/weather',
    )
    expect(await portland.text()).toContain('Portland, Oregon')
  })

  it('rejects invalid public weather coordinates without calling the provider', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
    const response = await workerExports.default.fetch(
      'https://webvista.test/weather?latitude=200&longitude=0',
    )

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
