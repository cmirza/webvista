import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { Favorite } from '../../services/favorites'
import { renderFavoriteIcon } from './favorite'

export async function renderDeleteFavoriteConfirmation(
  favorite: Favorite,
  enhanced = false,
): Promise<HtmlEscapedString> {
  return html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      id="favorite-delete-shell"
      data-favorite-delete-shell
    >
      <p class="text-sm font-semibold tracking-[0.16em] text-error uppercase">Favorites</p>
      <h2 class="mt-1 text-2xl font-semibold tracking-tight">Remove Favorite?</h2>
      <div class="mt-6 flex items-center gap-4 rounded-2xl bg-base-200 p-4">
        ${await renderFavoriteIcon(favorite, 'admin')}
        <div class="min-w-0">
          <p class="truncate font-semibold">${favorite.title}</p>
          <p class="mt-1 truncate text-sm text-base-content/60">${favorite.url}</p>
        </div>
      </div>
      <p class="mt-5 text-base-content/75">
        Remove <strong>${favorite.title}</strong> from Favorites? This cannot be undone.
      </p>
      <form
        class="mt-7 flex flex-wrap justify-end gap-3"
        method="post"
        action="/admin/favorites/${favorite.id}/delete"
        ${enhanced
          ? html`hx-delete="/admin/favorites/${favorite.id}"
              hx-target="#favorite-delete-shell"
              hx-swap="outerHTML"`
          : ''}
      >
        <input type="hidden" name="confirmed" value="yes" />
        ${enhanced
          ? html`<input type="hidden" name="presentation" value="dashboard" />`
          : ''}
        <a class="btn btn-ghost rounded-xl" href="/admin">Cancel</a>
        <button class="btn btn-error rounded-xl" type="submit">Remove Favorite</button>
      </form>
    </section>
  `
}

export async function renderDeleteFavoriteSuccess(
  favorite: Favorite,
  total: number,
  cleanupFailed = false,
): Promise<HtmlEscapedString> {
  return html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      id="favorite-delete-shell"
      data-favorite-delete-shell
      ${cleanupFailed ? '' : html`data-auto-dismiss="4500"`}
    >
      <div class="alert ${cleanupFailed ? 'alert-warning' : 'alert-success'}" role="status">
        <span>
          <strong>${favorite.title}</strong> was removed.${cleanupFailed
            ? ' Its uploaded icon could not be cleaned up automatically.'
            : ''}
        </span>
      </div>
      ${cleanupFailed
        ? html`<div class="mt-5 flex justify-end">
            <a class="btn btn-primary rounded-xl" href="/admin">Return to Admin</a>
          </div>`
        : ''}
    </section>
    <li id="admin-favorite-${favorite.id}" hx-swap-oob="delete"></li>
    <span
      class="badge badge-ghost"
      id="favorites-count"
      aria-label="${total} favorites"
      hx-swap-oob="outerHTML"
    >
      ${total}
    </span>
    ${total === 0
      ? html`<div
          class="mt-4 rounded-2xl border border-dashed border-base-300 px-6 py-12 text-center"
          id="admin-empty-state"
          hx-swap-oob="afterend:#admin-favorites-list"
        >
          <h3 class="font-semibold">No favorites yet</h3>
          <p class="mt-2 text-sm text-base-content/60">
            Add a site to place it on the portal.
          </p>
        </div>`
      : ''}
  `
}
