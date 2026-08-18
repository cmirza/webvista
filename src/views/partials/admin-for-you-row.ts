import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { ForYouItem } from '../../services/for-you'

export async function renderAdminForYouRow(
  item: ForYouItem,
  options: { oob?: boolean } = {},
): Promise<HtmlEscapedString> {
  return html`
    <li
      class="admin-favorite-row"
      id="admin-for-you-${item.id}"
      data-admin-for-you-row
      data-for-you-id="${item.id}"
      ${options.oob ? html`hx-swap-oob="outerHTML"` : ''}
    >
      <span class="admin-drag-handle" aria-hidden="true" title="Drag to reorder">
        <span></span><span></span><span></span>
      </span>
      <div class="admin-for-you-thumbnail" aria-hidden="true">
        ${item.imageUrl
          ? html`<img src="${item.imageUrl}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
          : item.sourceName.charAt(0).toUpperCase()}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <p class="truncate font-semibold">${item.title}</p>
          ${item.enabled
            ? ''
            : html`<span class="badge badge-ghost badge-sm">Hidden</span>`}
        </div>
        <p class="truncate text-sm text-base-content/65">${item.sourceName}</p>
      </div>
      <div class="admin-row-actions" aria-label="Actions for ${item.title}">
        <button
          class="btn btn-ghost btn-sm rounded-lg"
          type="button"
          data-move-for-you="up"
          aria-label="Move ${item.title} up"
          title="Move up"
        >↑</button>
        <button
          class="btn btn-ghost btn-sm rounded-lg"
          type="button"
          data-move-for-you="down"
          aria-label="Move ${item.title} down"
          title="Move down"
        >↓</button>
        <a
          class="btn btn-ghost btn-sm rounded-lg"
          href="/admin/for-you/${item.id}/edit"
          hx-get="/admin/for-you/${item.id}/edit"
          hx-target="#admin-workspace"
          hx-swap="innerHTML show:#admin-workspace:top"
        >Edit</a>
        <a
          class="critical-text btn btn-ghost btn-sm rounded-lg"
          href="/admin/for-you/${item.id}/delete"
          hx-get="/admin/for-you/${item.id}/delete"
          hx-target="#admin-workspace"
          hx-swap="innerHTML show:#admin-workspace:top"
        >Remove</a>
      </div>
    </li>
  `
}
