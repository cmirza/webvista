import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { Favorite, IconMode } from '../../services/favorites'
import type { SiteMetadata } from '../../services/icons'
import { renderAdminFavoriteRow } from './admin-favorite-row'
import { renderFavoriteIcon } from './favorite'

export type AddFavoriteFormValues = {
  title: string
  url: string
  iconMode: IconMode
}

export type AddFavoriteFormOptions = {
  enhanced?: boolean
  errors?: Record<string, string>
  values?: Partial<AddFavoriteFormValues>
}

const defaults: AddFavoriteFormValues = {
  title: '',
  url: '',
  iconMode: 'auto',
}

async function renderTitleInput(
  value: string,
  error?: string,
  oob = false,
): Promise<HtmlEscapedString> {
  return html`<div
    class="form-control"
    id="favorite-title-field"
    ${oob ? html`hx-swap-oob="outerHTML"` : ''}
  >
    <label class="label" for="favorite-title">
      <span class="label-text font-semibold">Display name</span>
    </label>
    <input
      class="input input-bordered w-full rounded-xl ${error ? 'input-error' : ''}"
      id="favorite-title"
      type="text"
      name="title"
      value="${value}"
      maxlength="100"
      autocomplete="off"
      aria-describedby="${error ? 'favorite-title-error' : undefined}"
      required
    />
    ${error
      ? html`<p class="mt-2 text-sm text-error" id="favorite-title-error">${error}</p>`
      : ''}
  </div>`
}

export async function renderAddFavoriteForm({
  enhanced = false,
  errors = {},
  values: suppliedValues = {},
}: AddFavoriteFormOptions = {}): Promise<HtmlEscapedString> {
  const values = { ...defaults, ...suppliedValues }

  return html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      id="favorite-form-shell"
      data-favorite-form-shell
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold tracking-[0.16em] text-primary uppercase">Favorites</p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight">Add Site</h2>
        </div>
        <a class="btn btn-ghost btn-sm rounded-lg" href="/admin">Cancel</a>
      </div>
      <form
        class="mt-6 space-y-5"
        method="post"
        action="/admin/favorites"
        enctype="multipart/form-data"
        data-favorite-form-action="add"
        ${enhanced
          ? html`hx-post="/admin/favorites"
              hx-encoding="multipart/form-data"
              hx-target="#favorite-form-shell"
              hx-swap="outerHTML"`
          : ''}
      >
        ${enhanced
          ? html`<input type="hidden" name="presentation" value="dashboard" />`
          : ''}
        ${await renderTitleInput(values.title, errors.title)}
        <div class="form-control">
          <label class="label" for="favorite-url">
            <span class="label-text font-semibold">Web address</span>
          </label>
          <input
            class="input input-bordered w-full rounded-xl ${errors.url ? 'input-error' : ''}"
            id="favorite-url"
            type="url"
            name="url"
            value="${values.url}"
            maxlength="2048"
            placeholder="https://example.com"
            autocomplete="url"
            aria-describedby="${errors.url ? 'favorite-url-error' : 'favorite-url-help'}"
            required
          />
          ${errors.url
            ? html`<p class="mt-2 text-sm text-error" id="favorite-url-error">${errors.url}</p>`
            : html`<p class="mt-2 text-sm text-base-content/55" id="favorite-url-help">
                Include https:// or http://.
              </p>`}
        </div>
        <fieldset class="space-y-3">
          <legend class="font-semibold">Icon</legend>
          <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-base-300 p-4">
            <input
              class="radio radio-primary mt-0.5"
              type="radio"
              name="iconMode"
              value="auto"
              ${values.iconMode === 'auto' ? 'checked' : ''}
            />
            <span>
              <span class="block font-medium">Automatic</span>
              <span class="mt-1 block text-sm text-base-content/60">
                Find the best icon supplied by the website.
              </span>
            </span>
          </label>
          <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-base-300 p-4">
            <input
              class="radio radio-primary mt-0.5"
              type="radio"
              name="iconMode"
              value="fallback"
              ${values.iconMode === 'fallback' ? 'checked' : ''}
            />
            <span>
              <span class="block font-medium">Generated fallback</span>
              <span class="mt-1 block text-sm text-base-content/60">
                Use a simple initial-based icon.
              </span>
            </span>
          </label>
          <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-base-300 p-4">
            <input
              class="radio radio-primary mt-0.5"
              type="radio"
              name="iconMode"
              value="upload"
              ${values.iconMode === 'upload' ? 'checked' : ''}
            />
            <span class="min-w-0 flex-1">
              <span class="block font-medium">Custom upload</span>
              <span class="mt-1 block text-sm text-base-content/60">
                Upload a PNG, JPEG, or WebP image up to 2 MB.
              </span>
              <input
                class="file-input file-input-bordered mt-3 w-full rounded-xl"
                type="file"
                name="iconFile"
                accept="image/png,image/jpeg,image/webp"
                data-custom-icon-input
                aria-describedby="${errors.iconFile ? 'favorite-icon-file-error' : undefined}"
              />
            </span>
          </label>
          ${errors.iconFile
            ? html`<p class="text-sm text-error" id="favorite-icon-file-error">
                ${errors.iconFile}
              </p>`
            : ''}
          ${errors.iconMode
            ? html`<p class="text-sm text-error" id="favorite-icon-mode-error">
                ${errors.iconMode}
              </p>`
            : ''}
        </fieldset>
        <div class="rounded-2xl bg-base-200 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="font-semibold">Icon preview</h3>
              <p class="mt-1 text-sm text-base-content/60">
                Previewing is optional; automatic discovery also runs when you save.
              </p>
            </div>
            <button
              class="btn btn-outline btn-sm rounded-lg"
              type="button"
              hx-get="/admin/favorites/icon-preview"
              hx-include="closest form"
              hx-target="#favorite-icon-preview"
              hx-swap="innerHTML"
              hx-indicator="#favorite-preview-loading"
            >
              Preview icon
            </button>
          </div>
          <div class="mt-4" id="favorite-icon-preview" aria-live="polite">
            <p class="text-sm text-base-content/55">Enter a web address, then preview its icon.</p>
          </div>
          <span class="loading loading-spinner loading-sm htmx-indicator mt-3" id="favorite-preview-loading">
            <span class="sr-only">Loading preview</span>
          </span>
        </div>
        <div class="flex flex-wrap justify-end gap-3 pt-2">
          <a class="btn btn-ghost rounded-xl" href="/admin">Cancel</a>
          <button class="btn btn-primary rounded-xl" type="submit">Add Favorite</button>
        </div>
      </form>
    </section>
  `
}

function previewTitle(values: AddFavoriteFormValues, metadata: SiteMetadata): string {
  if (values.title.trim()) {
    return values.title.trim()
  }

  if (metadata.title) {
    return metadata.title.slice(0, 100)
  }

  try {
    return new URL(values.url).hostname.replace(/^www\./, '')
  } catch {
    return 'Site'
  }
}

export async function renderFavoriteIconPreview(
  values: AddFavoriteFormValues,
  metadata: SiteMetadata,
): Promise<HtmlEscapedString> {
  const title = previewTitle(values, metadata)
  const suggestedTitle = metadata.title?.slice(0, 100) ?? null
  const previewFavorite = {
    id: 'preview',
    title,
    url: values.url,
    position: 0,
    iconMode: metadata.icon ? ('auto' as const) : ('fallback' as const),
    iconUrl: metadata.icon?.url ?? null,
    iconStorageKey: null,
    enabled: true,
    createdAt: '',
    updatedAt: '',
  }

  return html`
    ${!values.title.trim() && suggestedTitle
      ? await renderTitleInput(suggestedTitle, undefined, true)
      : ''}
    <div class="flex items-center gap-4" data-icon-preview-result>
      ${await renderFavoriteIcon(previewFavorite, 'admin')}
      <div class="min-w-0">
        <p class="truncate font-semibold">${title}</p>
        <p class="mt-1 text-sm text-base-content/60">
          ${metadata.icon
            ? `Found a ${metadata.icon.source.replaceAll('-', ' ')}.`
            : 'No suitable site icon was found; a generated fallback will be used.'}
        </p>
        ${values.title.trim() && suggestedTitle && values.title.trim() !== suggestedTitle
          ? html`<p class="mt-1 text-sm text-base-content/55">
              Suggested name: ${suggestedTitle}. Your display name will be kept.
            </p>`
          : ''}
      </div>
    </div>
  `
}

export async function renderFavoritePreviewError(
  message: string,
): Promise<HtmlEscapedString> {
  return html`<div class="alert alert-warning py-3 text-sm" role="alert">${message}</div>`
}

export async function renderAddFavoriteSuccess(
  favorite: Favorite,
  total: number,
): Promise<HtmlEscapedString> {
  return html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      id="favorite-form-shell"
      data-favorite-form-shell
      data-auto-dismiss="4500"
    >
      <div class="alert alert-success" role="status">
        <span><strong>${favorite.title}</strong> was added to Favorites.</span>
      </div>
      <div class="mt-5 flex flex-wrap justify-end gap-3">
        <button
          class="btn btn-primary rounded-xl"
          type="button"
          hx-get="/admin/favorites/new"
          hx-target="#favorite-form-shell"
          hx-swap="outerHTML"
        >
          Add another
        </button>
      </div>
    </section>
    <div hx-swap-oob="beforeend:#admin-favorites-list">
      ${await renderAdminFavoriteRow(favorite)}
    </div>
    <span
      class="badge badge-ghost"
      id="favorites-count"
      aria-label="${total} favorites"
      hx-swap-oob="outerHTML"
    >
      ${total}
    </span>
    <div id="admin-empty-state" hx-swap-oob="delete"></div>
  `
}
