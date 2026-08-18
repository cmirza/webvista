import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { Favorite } from '../services/favorites'
import type { ForYouItem } from '../services/for-you'
import type { WatchItem } from '../services/watch'
import { renderLayout } from './layout'
import { renderAdminFavoriteRow } from './partials/admin-favorite-row'
import { renderAdminForYouRow } from './partials/admin-for-you-row'
import { renderAdminWatchRow } from './partials/admin-watch-row'

type LoginOptions = {
  error?: string
  next?: string
  unavailable?: boolean
}

async function renderAdminHeader(): Promise<HtmlEscapedString> {
  return html`
    <header class="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-base-100 p-6 shadow-sm">
      <div>
        <p class="brand-eyebrow text-sm font-semibold tracking-[0.16em] uppercase">WebVista</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-tight">Admin Panel</h1>
      </div>
      <div class="flex items-center gap-2">
        <a class="btn btn-ghost rounded-xl" href="/">View Portal</a>
        <form method="post" action="/admin/logout">
          <button class="btn btn-outline rounded-xl" type="submit">Log out</button>
        </form>
      </div>
    </header>
  `
}

export async function renderAdminLogin({
  error,
  next = '/admin',
  unavailable = false,
}: LoginOptions = {}): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="grid min-h-screen place-items-center px-6 py-12">
      <section class="w-full max-w-md rounded-3xl bg-base-100 p-8 shadow-sm sm:p-10">
        <p class="brand-eyebrow mb-3 text-sm font-semibold tracking-[0.16em] uppercase">
          WebVista Admin
        </p>
        <h1 class="text-3xl font-semibold tracking-tight">Sign in</h1>
        ${unavailable
          ? html`<div class="alert alert-error mt-6" role="alert">
              Authentication is not configured. Add the local secrets and restart WebVista.
            </div>`
          : html`<form class="mt-7 space-y-5" method="post" action="/admin/login">
              ${next !== '/admin'
                ? html`<input type="hidden" name="next" value="${next}" />`
                : ''}
              ${error
                ? html`<div class="alert alert-error" role="alert">${error}</div>`
                : ''}
              <label class="form-control block">
                <span class="label-text mb-2 block font-semibold text-base-content">Password</span>
                <input
                  class="input input-bordered input-lg w-full rounded-xl"
                  type="password"
                  name="password"
                  autocomplete="current-password"
                  maxlength="1024"
                  required
                  autofocus
                />
              </label>
              <button class="btn btn-primary btn-lg w-full rounded-xl" type="submit">
                Sign in
              </button>
            </form>`}
        <a class="btn btn-ghost mt-5 w-full rounded-xl" href="/">Return to WebVista</a>
      </section>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'WebVista administration',
    robots: 'noindex,nofollow',
    title: 'Admin sign in · WebVista',
  })
}

export async function renderAdminDashboard(
  favorites: Favorite[],
  forYouItems: ForYouItem[],
  forYouVisible: boolean,
  watchItems: WatchItem[] = [],
): Promise<HtmlEscapedString> {
  const favoriteRows = await Promise.all(
    favorites.map((favorite) => renderAdminFavoriteRow(favorite)),
  )
  const forYouRows = await Promise.all(
    forYouItems.map((item) => renderAdminForYouRow(item)),
  )
  const watchRows = await Promise.all(
    watchItems.map((item) => renderAdminWatchRow(item)),
  )
  const content = await html`
    <main class="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      ${await renderAdminHeader()}
      <div class="mt-6 empty:hidden" id="admin-workspace" aria-live="polite"></div>
      <section class="mt-6 rounded-3xl bg-base-100 p-4 shadow-sm sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-4 px-2 py-2">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-semibold">Favorites</h2>
              <span
                class="badge badge-ghost"
                id="favorites-count"
                aria-label="${favorites.length} favorites"
              >
                ${favorites.length}
              </span>
            </div>
            <p class="mt-1 text-sm text-base-content/75">
              These favorites appear on the portal in this order.
            </p>
          </div>
          <a
            class="btn btn-primary rounded-xl"
            href="/admin/favorites/new"
            hx-get="/admin/favorites/new"
            hx-target="#admin-workspace"
            hx-swap="innerHTML show:#admin-workspace:top"
          >
            <span aria-hidden="true">+</span>
            Add Favorite
          </a>
        </div>
        <ol
          class="mt-4 divide-y divide-base-300"
          id="admin-favorites-list"
          data-admin-favorites-list
        >
          ${favoriteRows}
        </ol>
        ${favorites.length === 0
          ? html`<div
              class="mt-4 rounded-2xl border border-dashed border-base-300 px-6 py-12 text-center"
              id="admin-empty-state"
            >
              <h3 class="font-semibold">No favorites yet</h3>
              <p class="mt-2 text-sm text-base-content/75">
                Add a website or app link to place it on the portal.
              </p>
            </div>`
          : ''}
        <p
          class="px-2 pt-5 text-center text-sm text-base-content/75"
          id="favorites-order-status"
          role="status"
          aria-live="polite"
        >
          Drag a row or use its Move buttons to change the portal order.
        </p>
      </section>
      <section class="mt-6 rounded-3xl bg-base-100 p-4 shadow-sm sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-4 px-2 py-2">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-semibold">For You</h2>
              <span
                class="badge badge-ghost"
                id="for-you-count"
                aria-label="${forYouItems.length} For You links"
              >${forYouItems.length}</span>
            </div>
            <p class="mt-1 text-sm text-base-content/75">
              Articles, videos, and links shown in the portal carousel.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <a class="btn btn-outline rounded-xl" href="/admin/for-you/bookmarklet">
              Bookmarklet
            </a>
            <a
              class="btn btn-primary rounded-xl"
              href="/admin/for-you/new"
              hx-get="/admin/for-you/new"
              hx-target="#admin-workspace"
              hx-swap="innerHTML show:#admin-workspace:top"
            >
              <span aria-hidden="true">+</span>
              Add Link
            </a>
          </div>
        </div>
        <form
          class="mx-2 mt-4 rounded-2xl bg-base-200 p-4"
          method="post"
          action="/admin/for-you/visibility"
          hx-post="/admin/for-you/visibility"
          hx-trigger="change"
          hx-target="#for-you-visibility-status"
          hx-swap="innerHTML"
          hx-sync="this:replace"
        >
          <label class="flex cursor-pointer items-center gap-3">
            <input
              class="toggle toggle-primary"
              type="checkbox"
              name="enabled"
              value="1"
              ${forYouVisible ? 'checked' : ''}
            />
            <span>
              <span class="block font-semibold">Show For You on portal</span>
              <span class="block text-sm text-base-content/75">
                Links stay saved while the section is hidden.
              </span>
            </span>
          </label>
          <p
            class="mt-2 min-h-5 pl-[4.25rem] text-sm text-base-content/75"
            id="for-you-visibility-status"
            role="status"
            aria-live="polite"
          ></p>
          <noscript>
            <button class="btn btn-outline btn-sm mt-3 rounded-lg" type="submit">
              Save visibility
            </button>
          </noscript>
        </form>
        <ol
          class="mt-4 divide-y divide-base-300"
          id="admin-for-you-list"
          data-admin-for-you-list
        >${forYouRows}</ol>
        ${forYouItems.length === 0
          ? html`<div
              class="mt-4 rounded-2xl border border-dashed border-base-300 px-6 py-10 text-center"
              id="admin-for-you-empty-state"
            >
              <h3 class="font-semibold">No links yet</h3>
              <p class="mt-2 text-sm text-base-content/75">Add a story, video, or webpage to start the carousel.</p>
            </div>`
          : ''}
        <p
          class="px-2 pt-5 text-center text-sm text-base-content/75"
          id="for-you-order-status"
          role="status"
          aria-live="polite"
        >
          Drag a row or use its Move buttons to change the carousel order.
        </p>
      </section>
      <section class="mt-6 rounded-3xl bg-base-100 p-4 shadow-sm sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-4 px-2 py-2">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-semibold">Watch</h2>
              <span class="badge badge-ghost" id="watch-count" aria-label="${watchItems.length} Watch titles">${watchItems.length}</span>
            </div>
            <p class="mt-1 text-sm text-base-content/75">
              Movies and TV shows shown in the portal poster row.
            </p>
          </div>
          <a
            class="btn btn-primary rounded-xl"
            href="/admin/watch/new"
            hx-get="/admin/watch/new"
            hx-target="#admin-workspace"
            hx-swap="innerHTML show:#admin-workspace:top"
          >
            <span aria-hidden="true">+</span>
            Add Title
          </a>
        </div>
        <ol
          class="mt-4 divide-y divide-base-300"
          id="admin-watch-list"
          data-admin-watch-list
        >${watchRows}</ol>
        ${watchItems.length === 0
          ? html`<div class="mt-4 rounded-2xl border border-dashed border-base-300 px-6 py-10 text-center" id="admin-watch-empty-state">
              <h3 class="font-semibold">Nothing to watch yet</h3>
              <p class="mt-2 text-sm text-base-content/75">Add a movie or TV show with its direct streaming link.</p>
            </div>`
          : ''}
        <p
          class="px-2 pt-5 text-center text-sm text-base-content/75"
          id="watch-order-status"
          role="status"
          aria-live="polite"
        >
          Drag a row or use its Move buttons to change the poster order.
        </p>
      </section>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'WebVista administration',
    htmx: true,
    robots: 'noindex,nofollow',
    scripts: ['/assets/sortable.min.js', '/assets/admin.js'],
    title: 'Admin · WebVista',
  })
}

export async function renderAdminWatchAddPage(
  form: HtmlEscapedString,
): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      ${await renderAdminHeader()}
      <div class="mt-6">${form}</div>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'Add a title to Watch',
    robots: 'noindex,nofollow',
    title: 'Add Watch Title · WebVista',
  })
}

export async function renderAdminWatchEditPage(
  form: HtmlEscapedString,
): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      ${await renderAdminHeader()}
      <div class="mt-6">${form}</div>
    </main>
  `
  return renderLayout({
    children: content,
    description: 'Edit a Watch title',
    robots: 'noindex,nofollow',
    title: 'Edit Watch Title · WebVista',
  })
}

export async function renderAdminWatchDeletePage(
  confirmation: HtmlEscapedString,
): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      ${await renderAdminHeader()}
      <div class="mt-6">${confirmation}</div>
    </main>
  `
  return renderLayout({
    children: content,
    description: 'Remove a Watch title',
    robots: 'noindex,nofollow',
    title: 'Remove Watch Title · WebVista',
  })
}

export async function renderAdminForYouAddPage(
  form: HtmlEscapedString,
): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      ${await renderAdminHeader()}
      <div class="mt-6">${form}</div>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'Add a link to For You',
    robots: 'noindex,nofollow',
    title: 'Add For You Link · WebVista',
  })
}

export async function renderAdminForYouEditPage(
  form: HtmlEscapedString,
): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      ${await renderAdminHeader()}
      <div class="mt-6">${form}</div>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'Edit a For You link',
    robots: 'noindex,nofollow',
    title: 'Edit For You Link · WebVista',
  })
}

export async function renderAdminForYouBookmarkletPage(
  bookmarklet: string,
): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      ${await renderAdminHeader()}
      <section class="mt-6 rounded-3xl bg-base-100 p-6 shadow-sm sm:p-8">
        <p class="brand-eyebrow text-sm font-semibold tracking-[0.16em] uppercase">For You</p>
        <h2 class="mt-1 text-3xl font-semibold tracking-tight">Install Bookmarklet</h2>
        <p class="mt-3 text-base-content/75">
          Use this while viewing an article to capture its published preview details and open an editable WebVista preview.
        </p>

        <div class="mt-7 rounded-2xl bg-base-200 p-5">
          <h3 class="font-semibold">Desktop browser</h3>
          <p class="mt-2 text-sm text-base-content/75">
            Show your bookmarks bar, then drag this button onto it. Select it whenever an article is open.
          </p>
          <a
            class="btn btn-primary mt-4 rounded-xl"
            href="${bookmarklet}"
            draggable="true"
          >
            Add to WebVista
          </a>
        </div>

        <div class="mt-5 rounded-2xl bg-base-200 p-5">
          <h3 class="font-semibold">iPhone or iPad</h3>
          <ol class="mt-2 list-decimal space-y-2 pl-5 text-sm text-base-content/75">
            <li>Bookmark any page in Safari and name it Add to WebVista.</li>
            <li>Copy the bookmarklet code below.</li>
            <li>Edit the bookmark and replace its address with the copied code.</li>
            <li>Open an article, then choose Add to WebVista from your bookmarks.</li>
          </ol>
          <button
            class="btn btn-outline btn-sm mt-4 rounded-lg"
            type="button"
            data-copy-bookmarklet
          >
            Copy Bookmarklet Code
          </button>
          <p
            class="mt-2 min-h-5 text-sm text-base-content/75"
            role="status"
            aria-live="polite"
            data-bookmarklet-copy-status
          ></p>
          <details class="mt-3">
            <summary class="cursor-pointer text-sm font-semibold">Show code</summary>
            <textarea
              class="textarea textarea-bordered mt-3 min-h-32 w-full rounded-xl font-mono text-xs"
              id="bookmarklet-code"
              readonly
            >${bookmarklet}</textarea>
          </details>
        </div>

        <div class="mt-7 flex justify-end">
          <a class="btn btn-ghost rounded-xl" href="/admin">Back to Admin</a>
        </div>
      </section>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'Install the WebVista For You bookmarklet',
    robots: 'noindex,nofollow',
    scripts: ['/assets/admin.js'],
    title: 'Install Bookmarklet · WebVista',
  })
}

export async function renderAdminForYouDeletePage(
  confirmation: HtmlEscapedString,
): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      ${await renderAdminHeader()}
      <div class="mt-6">${confirmation}</div>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'Remove a For You link',
    robots: 'noindex,nofollow',
    title: 'Remove For You Link · WebVista',
  })
}

export async function renderAdminAddPage(
  form: HtmlEscapedString,
): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      ${await renderAdminHeader()}
      <div class="mt-6">${form}</div>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'Add a WebVista favorite',
    htmx: true,
    robots: 'noindex,nofollow',
    scripts: ['/assets/admin.js'],
    title: 'Add Favorite · WebVista',
  })
}

export async function renderAdminEditPage(
  form: HtmlEscapedString,
): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      ${await renderAdminHeader()}
      <div class="mt-6">${form}</div>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'Edit a WebVista favorite',
    htmx: true,
    robots: 'noindex,nofollow',
    scripts: ['/assets/admin.js'],
    title: 'Edit Favorite · WebVista',
  })
}

export async function renderAdminDeletePage(
  confirmation: HtmlEscapedString,
): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      ${await renderAdminHeader()}
      <div class="mt-6">${confirmation}</div>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'Remove a WebVista favorite',
    robots: 'noindex,nofollow',
    title: 'Remove Site · WebVista',
  })
}
