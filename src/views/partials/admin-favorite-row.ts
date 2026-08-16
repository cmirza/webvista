import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { Favorite } from '../../services/favorites'
import { renderFavoriteIcon } from './favorite'

function hostnameFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export async function renderAdminFavoriteRow(
  favorite: Favorite,
  options: { oob?: boolean } = {},
): Promise<HtmlEscapedString> {
  return html`
    <li
      class="admin-favorite-row"
      id="admin-favorite-${favorite.id}"
      data-admin-favorite-row
      data-favorite-id="${favorite.id}"
      ${options.oob ? html`hx-swap-oob="outerHTML"` : ''}
    >
      <span
        class="admin-drag-handle"
        aria-hidden="true"
        title="Drag ordering will be enabled in a later step"
      >
        <span></span><span></span><span></span>
      </span>
      ${await renderFavoriteIcon(favorite, 'admin')}
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="truncate font-semibold">${favorite.title}</h3>
          ${favorite.enabled
            ? ''
            : html`<span class="badge badge-ghost badge-sm">Hidden</span>`}
        </div>
        <p class="truncate text-sm text-base-content/60">${hostnameFor(favorite.url)}</p>
      </div>
      <div class="admin-row-actions" aria-label="Actions for ${favorite.title}">
        <a
          class="btn btn-ghost btn-sm rounded-lg"
          href="/admin/favorites/${favorite.id}/edit"
          hx-get="/admin/favorites/${favorite.id}/edit"
          hx-target="#admin-workspace"
          hx-swap="innerHTML show:#admin-workspace:top"
        >
          Edit
        </a>
        <button
          class="btn btn-ghost btn-sm rounded-lg text-error"
          type="button"
          disabled
          title="Deletion will be available in a later step"
        >
          Remove
        </button>
      </div>
    </li>
  `
}
