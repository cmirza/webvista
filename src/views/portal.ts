import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { Favorite } from '../services/favorites'
import type { ForYouItem } from '../services/for-you'
import type { WatchItem } from '../services/watch'
import { renderLayout } from './layout'
import { renderFavorite } from './partials/favorite'
import { renderForYouCard } from './partials/for-you-card'
import { renderWatchCard } from './partials/watch-card'

export async function renderPortal(
  favorites: Favorite[],
  forYouItems: ForYouItem[],
  watchItems: WatchItem[] = [],
): Promise<HtmlEscapedString> {
  const forYouCards = await Promise.all(forYouItems.map(renderForYouCard))
  const watchCards = await Promise.all(watchItems.map(renderWatchCard))
  const now = new Date()
  const serverDate = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
  }).format(now)
  const content = await html`
    <main class="portal-shell mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 sm:px-10 sm:py-14 lg:px-12">
      <header class="portal-header mb-10 grid items-end gap-8 sm:mb-14 lg:grid-cols-[minmax(0,1fr)_minmax(30rem,38rem)]">
        <div>
          <h1 class="brand-eyebrow text-sm font-semibold tracking-[0.18em] uppercase">WebVista</h1>
        </div>

        <div class="portal-status-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(0,1.3fr)]">
          <section class="portal-status-card rounded-3xl bg-base-100 p-5 shadow-sm" aria-labelledby="date-heading">
            <p class="text-xs font-semibold tracking-[0.16em] text-base-content/75 uppercase" id="date-heading">
              Today
            </p>
            <time
              class="mt-2 block text-xl font-semibold leading-tight tracking-tight lg:whitespace-nowrap"
              datetime="${now.toISOString().slice(0, 10)}"
              data-local-date
            >${serverDate}</time>
          </section>

          <section
            class="portal-status-card rounded-3xl bg-base-100 p-5 shadow-sm"
            aria-labelledby="weather-heading"
            aria-live="polite"
            data-weather-panel
          >
            <p class="sr-only" id="weather-heading">Weather</p>
            <div data-weather-content>
              <p class="font-semibold">Loading Portland weather…</p>
              <p class="mt-1 text-sm text-base-content/75">
                Forecast for the 97209 area.
              </p>
            </div>
          </section>
        </div>
      </header>

      <section aria-labelledby="search-heading" class="portal-search mb-12 sm:mb-16">
        <h2 id="search-heading" class="sr-only">Search Google</h2>
        <form
          action="https://www.google.com/search"
          method="get"
          class="flex flex-col gap-3 sm:flex-row"
        >
          <div class="relative w-full">
            <label class="sr-only" for="google-search">Search Google</label>
            <input
              id="google-search"
              class="portal-search-input peer input input-lg h-16 w-full rounded-2xl border-base-300 bg-base-100 px-6 text-lg shadow-sm outline-none placeholder:text-transparent focus:border-primary focus:ring-4 focus:ring-primary/15"
              type="search"
              name="q"
              placeholder="Search Google..."
              autocomplete="off"
            />
            <div
              aria-hidden="true"
              data-search-prompt
              class="pointer-events-none absolute inset-y-0 left-6 flex items-center text-lg transition-opacity duration-150 peer-focus:opacity-0 peer-[:not(:placeholder-shown)]:opacity-0"
            >
              <span class="text-base-content/75">Search&nbsp;</span>
              <span class="font-semibold tracking-tight">
                <span class="text-[#4285f4]">G</span><span class="text-[#ea4335]">o</span><span class="text-[#fbbc05]">o</span><span class="text-[#4285f4]">g</span><span class="text-[#34a853]">l</span><span class="text-[#ea4335]">e</span>
              </span>
              <span class="text-base-content/75">...</span>
            </div>
          </div>
          <button class="portal-search-button btn btn-primary h-16 rounded-2xl px-8 text-lg shadow-sm" type="submit">
            Search
          </button>
        </form>
      </section>

      <section class="favorites-section" aria-labelledby="favorites-heading" data-horizontal-carousel>
        <div class="portal-section-header mb-6 flex items-end justify-between gap-4">
          <div>
            <p class="mb-1 text-xs font-semibold tracking-[0.16em] text-base-content/75 uppercase">
              Quick access
            </p>
            <h2 id="favorites-heading" class="text-2xl font-semibold tracking-tight">Favorites</h2>
          </div>
          ${favorites.length > 0
            ? html`
                <div class="favorites-carousel-controls flex gap-2" aria-label="Browse Favorites">
                  <button class="btn btn-circle btn-outline" type="button" data-carousel-control="previous" aria-controls="favorites-track" aria-label="Previous favorites">←</button>
                  <button class="btn btn-circle btn-outline" type="button" data-carousel-control="next" aria-controls="favorites-track" aria-label="Next favorites">→</button>
                </div>
              `
            : ''}
        </div>

        ${favorites.length > 0
          ? html`
              <div class="favorites-grid" id="favorites-track" tabindex="0" data-favorites-grid data-horizontal-carousel-track>
                ${favorites.map(renderFavorite)}
              </div>
            `
          : html`
              <div class="rounded-3xl bg-base-100 px-6 py-12 text-center shadow-sm sm:px-10">
                <p class="text-lg font-medium">Your favorites will appear here.</p>
                <p class="mt-2 text-base-content/75">
                  Add favorite sites from the administration area when it is available.
                </p>
              </div>
            `}
      </section>

      ${watchItems.length > 0
        ? html`
            <section class="portal-carousel-section mt-14 sm:mt-18" aria-labelledby="watch-heading" data-horizontal-carousel>
              <div class="portal-section-header mb-6 flex items-end justify-between gap-4">
                <div>
                  <p class="mb-1 text-xs font-semibold tracking-[0.16em] text-base-content/75 uppercase">
                    Movies and shows
                  </p>
                  <h2 id="watch-heading" class="text-2xl font-semibold tracking-tight">Watch</h2>
                </div>
                <div class="flex gap-2" aria-label="Browse Watch titles">
                  <button class="btn btn-circle btn-outline" type="button" data-carousel-control="previous" aria-controls="watch-track" aria-label="Previous titles">←</button>
                  <button class="btn btn-circle btn-outline" type="button" data-carousel-control="next" aria-controls="watch-track" aria-label="Next titles">→</button>
                </div>
              </div>
              <div class="watch-track" id="watch-track" tabindex="0" data-horizontal-carousel-track>
                ${watchCards}
              </div>
            </section>
          `
        : ''}

      ${forYouItems.length > 0
        ? html`
            <section class="portal-carousel-section mt-14 sm:mt-18" aria-labelledby="for-you-heading" data-for-you-carousel data-horizontal-carousel>
              <div class="portal-section-header mb-6 flex items-end justify-between gap-4">
                <div>
                  <p class="mb-1 text-xs font-semibold tracking-[0.16em] text-base-content/75 uppercase">
                    Selected links
                  </p>
                  <h2 id="for-you-heading" class="text-2xl font-semibold tracking-tight">For You</h2>
                </div>
                <div class="flex gap-2" aria-label="Browse For You links">
                  <button class="btn btn-circle btn-outline" type="button" data-carousel-control="previous" aria-controls="for-you-track" aria-label="Previous links">←</button>
                  <button class="btn btn-circle btn-outline" type="button" data-carousel-control="next" aria-controls="for-you-track" aria-label="Next links">→</button>
                </div>
              </div>
              <div class="for-you-track" id="for-you-track" tabindex="0" data-horizontal-carousel-track>
                ${forYouCards}
              </div>
            </section>
          `
        : ''}
    </main>
  `

  return renderLayout({
    children: content,
    description: 'A simple, friendly browser home page.',
    scripts: ['/assets/portal.js'],
    title: 'WebVista',
  })
}
