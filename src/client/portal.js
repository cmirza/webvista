const searchInput = document.querySelector('#google-search')
const localDate = document.querySelector('[data-local-date]')
const weatherPanel = document.querySelector('[data-weather-panel]')
const weatherContent = weatherPanel?.querySelector('[data-weather-content]')
const weatherFragmentVersion = '3'

const updateLocalDate = () => {
  if (!(localDate instanceof HTMLTimeElement)) return

  const now = new Date()
  localDate.dateTime = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  localDate.textContent = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(now)
}

const showWeatherUnavailable = () => {
  if (!(weatherContent instanceof HTMLElement)) return
  weatherContent.innerHTML = `
    <div data-weather-unavailable>
      <p class="font-semibold">Weather is unavailable right now.</p>
      <button class="btn btn-ghost btn-sm mt-2 -ml-3 rounded-lg" type="button" data-weather-retry>
        Try again
      </button>
    </div>
  `
}

const loadWeather = async (latitude, longitude) => {
  if (!(weatherContent instanceof HTMLElement)) return

  const url = new URL('/weather', window.location.origin)
  url.searchParams.set('v', weatherFragmentVersion)
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    url.searchParams.set('latitude', (Math.round(latitude * 100) / 100).toString())
    url.searchParams.set('longitude', (Math.round(longitude * 100) / 100).toString())
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/html' },
    })
    if (!response.ok) throw new Error('Weather request failed.')
    weatherContent.innerHTML = await response.text()
  } catch {
    showWeatherUnavailable()
  }
}

const requestWeather = () => {
  if (!(weatherContent instanceof HTMLElement)) return

  weatherContent.innerHTML = `
    <p class="font-semibold">Finding local weather…</p>
    <p class="mt-1 text-sm text-base-content/75">Portland is used if location is unavailable.</p>
  `

  if (!('geolocation' in navigator)) {
    void loadWeather()
    return
  }

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => void loadWeather(coords.latitude, coords.longitude),
    () => void loadWeather(),
    {
      enableHighAccuracy: false,
      maximumAge: 30 * 60 * 1000,
      timeout: 5_000,
    },
  )
}

window.addEventListener('pageshow', () => {
  if (searchInput instanceof HTMLInputElement) {
    searchInput.value = ''
  }
  updateLocalDate()
})

updateLocalDate()
window.setInterval(updateLocalDate, 60 * 1000)
requestWeather()

weatherPanel?.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-weather-retry]')) {
    requestWeather()
  }
})

document.querySelectorAll('[data-horizontal-carousel]').forEach((carousel) => {
  const track = carousel.querySelector('[data-horizontal-carousel-track]')
  const previous = carousel.querySelector('[data-carousel-control="previous"]')
  const next = carousel.querySelector('[data-carousel-control="next"]')
  if (
    !(track instanceof HTMLElement) ||
    !(previous instanceof HTMLButtonElement) ||
    !(next instanceof HTMLButtonElement)
  ) {
    return
  }
  const updateControls = () => {
    previous.disabled = track.scrollLeft <= 2
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2
  }

  const move = (direction) => {
    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.8, 280),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }

  previous.addEventListener('click', () => move(-1))
  next.addEventListener('click', () => move(1))
  track.addEventListener('scroll', updateControls, { passive: true })
  window.addEventListener('resize', updateControls)
  window.addEventListener('pageshow', updateControls)
  updateControls()
})
