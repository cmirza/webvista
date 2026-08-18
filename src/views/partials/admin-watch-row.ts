import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { WatchItem } from '../../services/watch'

export async function renderAdminWatchRow(
  item: WatchItem,
  options: { oob?: boolean } = {},
): Promise<HtmlEscapedString> {
  const initial = item.title.trim().charAt(0).toUpperCase() || 'W'

  return html`
    <li
      class="admin-favorite-row"
      id="admin-watch-${item.id}"
      data-admin-watch-row
      data-watch-id="${item.id}"
      ${options.oob ? html`hx-swap-oob="outerHTML"` : ''}
    >
      <span class="admin-drag-handle" aria-hidden="true" title="Drag to reorder">
        <span></span><span></span><span></span>
      </span>
      <div class="admin-watch-poster" aria-hidden="true">
        <span>${initial}</span>
        ${item.posterUrl
          ? html`<img src="${item.posterUrl}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
          : ''}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <p class="truncate font-semibold">${item.title}</p>
          ${item.enabled ? '' : html`<span class="badge badge-ghost badge-sm">Hidden</span>`}
        </div>
        <p class="truncate text-sm text-base-content/75">
          ${item.year ? `${item.year} · ` : ''}${item.mediaType === 'movie' ? 'Movie' : 'TV Show'} · ${item.serviceName}
        </p>
      </div>
      <div class="admin-row-actions" aria-label="Actions for ${item.title}">
        <button
          class="btn btn-ghost btn-sm rounded-lg"
          type="button"
          data-move-watch="up"
          aria-label="Move ${item.title} up"
          title="Move up"
        >↑</button>
        <button
          class="btn btn-ghost btn-sm rounded-lg"
          type="button"
          data-move-watch="down"
          aria-label="Move ${item.title} down"
          title="Move down"
        >↓</button>
        <a
          class="btn btn-ghost btn-sm rounded-lg"
          href="/admin/watch/${item.id}/edit"
          hx-get="/admin/watch/${item.id}/edit"
          hx-target="#admin-workspace"
          hx-swap="innerHTML show:#admin-workspace:top"
        >Edit</a>
        <a
          class="critical-text btn btn-ghost btn-sm rounded-lg"
          href="/admin/watch/${item.id}/delete"
          hx-get="/admin/watch/${item.id}/delete"
          hx-target="#admin-workspace"
          hx-swap="innerHTML show:#admin-workspace:top"
        >Remove</a>
      </div>
    </li>
  `
}
