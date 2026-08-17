import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { Favorite } from '../services/favorites'
import { renderLayout } from './layout'
import { renderAdminFavoriteRow } from './partials/admin-favorite-row'

type LoginOptions = {
  error?: string
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
): Promise<HtmlEscapedString> {
  const favoriteRows = await Promise.all(
    favorites.map((favorite) => renderAdminFavoriteRow(favorite)),
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
