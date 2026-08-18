import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { WeatherPlace, WeatherSnapshot } from '../../services/weather'

export async function renderWeather(
  weather: WeatherSnapshot,
  place: WeatherPlace,
): Promise<HtmlEscapedString> {
  return html`
    <div class="flex min-w-0 items-center gap-4" data-weather-result>
      <span class="text-4xl" aria-hidden="true">${weather.symbol}</span>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <strong class="text-3xl font-semibold tracking-tight">${weather.temperature}°</strong>
          <span class="font-semibold">${weather.condition}</span>
        </div>
        <p class="mt-1 text-sm text-base-content/75">
          High ${weather.high}° · Low ${weather.low}° · ${place.label}
        </p>
      </div>
    </div>
  `
}

export async function renderWeatherUnavailable(): Promise<HtmlEscapedString> {
  return html`
    <div data-weather-unavailable>
      <p class="font-semibold">Weather is unavailable right now.</p>
      <button class="btn btn-ghost btn-sm mt-2 -ml-3 rounded-lg" type="button" data-weather-retry>
        Try again
      </button>
    </div>
  `
}
