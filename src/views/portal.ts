import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { renderLayout } from './layout'

export async function renderPortal(): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 sm:px-10 sm:py-14 lg:px-12">
      <header class="mb-10 sm:mb-14">
        <p class="mb-3 text-sm font-semibold tracking-[0.18em] text-primary uppercase">WebVista</p>
        <h1 class="text-4xl font-semibold tracking-tight sm:text-5xl">Start here.</h1>
        <p class="mt-4 max-w-2xl text-lg leading-8 text-base-content/70">
          Search the web or choose a favorite.
        </p>
      </header>

      <section aria-labelledby="search-heading" class="mb-12 sm:mb-16">
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
              class="peer input input-lg h-16 w-full rounded-2xl border-base-300 bg-base-100 px-6 text-lg shadow-sm outline-none placeholder:text-transparent focus:border-primary focus:ring-4 focus:ring-primary/15"
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
              <span class="text-base-content/45">Search&nbsp;</span>
              <span class="font-semibold tracking-tight">
                <span class="text-[#4285f4]">G</span><span class="text-[#ea4335]">o</span><span class="text-[#fbbc05]">o</span><span class="text-[#4285f4]">g</span><span class="text-[#34a853]">l</span><span class="text-[#ea4335]">e</span>
              </span>
              <span class="text-base-content/45">...</span>
            </div>
          </div>
          <button class="btn btn-primary h-16 rounded-2xl px-8 text-lg shadow-sm" type="submit">
            Search
          </button>
        </form>
      </section>

      <section aria-labelledby="favorites-heading">
        <div class="mb-6 flex items-end justify-between gap-4">
          <div>
            <p class="mb-1 text-xs font-semibold tracking-[0.16em] text-base-content/50 uppercase">
              Quick access
            </p>
            <h2 id="favorites-heading" class="text-2xl font-semibold tracking-tight">Favorites</h2>
          </div>
        </div>

        <div class="rounded-3xl bg-base-100 px-6 py-12 text-center shadow-sm sm:px-10">
          <p class="text-lg font-medium">Your favorites will appear here.</p>
          <p class="mt-2 text-base-content/60">The favorites library is the next data-backed feature.</p>
        </div>
      </section>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'A simple, friendly browser home page.',
    title: 'WebVista',
  })
}
