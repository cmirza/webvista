const searchInput = document.querySelector('#google-search')
const localDate = document.querySelector('[data-local-date]')
const weatherPanel = document.querySelector('[data-weather-panel]')
const weatherContent = weatherPanel?.querySelector('[data-weather-content]')
const weatherFragmentVersion = '4'

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

const loadWeather = async () => {
  if (!(weatherContent instanceof HTMLElement)) return

  const url = new URL('/weather', window.location.origin)
  url.searchParams.set('v', weatherFragmentVersion)

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
    <p class="font-semibold">Loading Portland weather…</p>
  `
  void loadWeather()
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
