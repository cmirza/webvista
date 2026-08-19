import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { WatchItem } from '../../services/watch'

export async function renderWatchCard(
  item: WatchItem,
): Promise<HtmlEscapedString> {
  const initial = item.title.trim().charAt(0).toUpperCase() || 'W'

  return html`
    <a class="watch-card" href="${item.watchUrl}" data-watch-id="${item.id}">
      <div class="watch-poster" aria-hidden="true">
        <span class="watch-poster-fallback">${initial}</span>
        ${item.posterUrl
          ? html`<img
              src="${item.posterUrl}"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
            />`
          : ''}
      </div>
      <div class="watch-body min-w-0 px-1 pt-3">
        <h3 class="watch-title">${item.title}</h3>
        <p class="watch-meta">
          ${item.serviceName}${item.year ? ` · ${item.year}` : ''} · ${item.mediaType === 'movie' ? 'Movie' : 'TV Show'}
        </p>
      </div>
    </a>
  `
}
