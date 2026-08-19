import { exports as workerExports } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  describeWeatherCode,
  fetchWeather,
  fetchWeatherPlace,
  PORTLAND_97209_WEATHER_LOCATION,
  WeatherError,
  weatherApiUrl,
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

afterEach(() => vi.restoreAllMocks())

describe('weather', () => {
  it('uses the fixed Portland 97209-area location', () => {
    expect(PORTLAND_97209_WEATHER_LOCATION).toEqual({
      latitude: 45.53,
      longitude: -122.68,
    })
  })

  it('requests current conditions and one-day Fahrenheit high and low', () => {
    const url = weatherApiUrl({
      latitude: 45.53,
      longitude: -122.68,
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

  it('uses the fixed Portland label without reverse geocoding', async () => {
    await expect(fetchWeatherPlace()).resolves.toEqual({
      label: 'Portland, Oregon',
    })
  })

  it('returns a compact, human-readable weather snapshot', async () => {
    const fetcher = vi.fn(async () => weatherResponse())

    await expect(
      fetchWeather(
        PORTLAND_97209_WEATHER_LOCATION,
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
        href: expect.stringContaining('latitude=45.53'),
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
        PORTLAND_97209_WEATHER_LOCATION,
        {
          fetcher: async () =>
            new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
        },
      ),
    ).rejects.toMatchObject({ code: 'invalid-response' })

    await expect(
      fetchWeather(
        PORTLAND_97209_WEATHER_LOCATION,
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

  it('serves fixed 97209-area weather regardless of query parameters', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      weatherResponse(),
    )

    const local = await workerExports.default.fetch(
      'https://webvista.test/weather?latitude=40.71&longitude=-74.00',
    )
    const localBody = await local.text()
    expect(local.status).toBe(200)
    expect(local.headers.get('cache-control')).toBe('public, max-age=600')
    expect(localBody).toContain('data-weather-result')
    expect(localBody).toContain('Portland, Oregon')
    expect(localBody).not.toContain('© OpenStreetMap')
    expect(localBody).not.toContain('Your location')
    expect(localBody).not.toContain('<html')
    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining('latitude=45.53') }),
      expect.any(Object),
    )
  })
})
