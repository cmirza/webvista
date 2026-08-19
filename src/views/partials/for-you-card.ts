import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { ForYouItem } from '../../services/for-you'

export async function renderForYouCard(
  item: ForYouItem,
): Promise<HtmlEscapedString> {
  const initial = item.sourceName.trim().charAt(0).toUpperCase() || 'W'

  return html`
    <a
      class="for-you-card"
      href="${item.url}"
      data-for-you-id="${item.id}"
    >
      <div class="for-you-image" aria-hidden="true">
        <span class="for-you-image-fallback">${initial}</span>
        ${item.imageUrl
          ? html`<img
              src="${item.imageUrl}"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
            />`
          : ''}
      </div>
      <div class="for-you-body min-w-0 p-5">
        <p class="for-you-source">${item.sourceName}</p>
        <h3 class="for-you-title">${item.title}</h3>
        ${item.description
          ? html`<p class="for-you-description">${item.description}</p>`
          : ''}
      </div>
    </a>
  `
}
