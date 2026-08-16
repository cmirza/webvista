import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { Favorite } from '../../services/favorites'

const fallbackStyles = [
  'bg-primary text-primary-content',
  'bg-secondary text-secondary-content',
  'bg-accent text-accent-content',
  'bg-neutral text-neutral-content',
] as const

const stringHash = (value: string): number => {
  let hash = 0

  for (const character of value) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0
  }

  return hash
}

const fallbackInitials = (title: string): string => {
  const words = title.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return '?'
  }

  if (words.length === 1) {
    return Array.from(words[0]).slice(0, 2).join('').toLocaleUpperCase()
  }

  return `${Array.from(words[0])[0]}${Array.from(words.at(-1)!)[0]}`.toLocaleUpperCase()
}

const renderableIconUrl = (value: string | null): string | null => {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

export async function renderFavorite(
  favorite: Favorite,
): Promise<HtmlEscapedString> {
  const iconUrl =
    favorite.iconMode === 'fallback'
      ? null
      : renderableIconUrl(favorite.iconUrl)
  const fallbackStyle = fallbackStyles[stringHash(favorite.title) % fallbackStyles.length]

  return html`
    <a
      class="favorite-link group"
      href="${favorite.url}"
      aria-label="Open ${favorite.title}"
      data-favorite-id="${favorite.id}"
    >
      <span class="favorite-icon ${fallbackStyle}" aria-hidden="true">
        ${iconUrl
          ? html`<img
              class="h-full w-full object-cover"
              src="${iconUrl}"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
            />`
          : html`<span class="favorite-initials">${fallbackInitials(favorite.title)}</span>`}
      </span>
      <span class="favorite-title">${favorite.title}</span>
    </a>
  `
}
