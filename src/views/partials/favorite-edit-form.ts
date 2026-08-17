import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { Favorite, IconMode } from '../../services/favorites'
import { renderAdminFavoriteRow } from './admin-favorite-row'
import { renderFavoriteIcon } from './favorite'

export type AutomaticIconAction = 'keep' | 'refresh'

export type EditFavoriteFormValues = {
  title: string
  url: string
  iconMode: IconMode
  automaticIconAction: AutomaticIconAction
  enabled: boolean
}

type EditFavoriteFormOptions = {
  enhanced?: boolean
  errors?: Record<string, string>
  favorite: Favorite
  values?: Partial<EditFavoriteFormValues>
}

const initialValues = (favorite: Favorite): EditFavoriteFormValues => ({
  title: favorite.title,
  url: favorite.url,
  iconMode: favorite.iconMode,
  automaticIconAction: favorite.iconMode === 'auto' ? 'keep' : 'refresh',
  enabled: favorite.enabled,
})

export async function renderEditFavoriteForm({
  enhanced = false,
  errors = {},
  favorite,
  values: suppliedValues = {},
}: EditFavoriteFormOptions): Promise<HtmlEscapedString> {
  const values = { ...initialValues(favorite), ...suppliedValues }

  return html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      id="favorite-form-shell"
      data-favorite-form-shell
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="brand-eyebrow text-sm font-semibold tracking-[0.16em] uppercase">Favorites</p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight">Edit Site</h2>
        </div>
        <a class="btn btn-ghost btn-sm rounded-lg" href="/admin">Cancel</a>
      </div>
      <form
        class="mt-6 space-y-5"
        method="post"
        action="/admin/favorites/${favorite.id}"
        enctype="multipart/form-data"
        data-favorite-form-action="edit"
        ${enhanced
          ? html`hx-post="/admin/favorites/${favorite.id}"
              hx-encoding="multipart/form-data"
              hx-target="#favorite-form-shell"
              hx-swap="outerHTML"`
          : ''}
      >
        ${enhanced
          ? html`<input type="hidden" name="presentation" value="dashboard" />`
          : ''}
        <div class="form-control">
          <label class="label" for="favorite-title">
            <span class="label-text font-semibold text-base-content">Display name</span>
          </label>
          <input
            class="input input-bordered w-full rounded-xl ${errors.title ? 'input-error' : ''}"
            id="favorite-title"
            type="text"
            name="title"
            value="${values.title}"
            maxlength="100"
            autocomplete="off"
            aria-describedby="${errors.title ? 'favorite-title-error' : undefined}"
            required
          />
          ${errors.title
            ? html`<p class="critical-text mt-2 text-sm" id="favorite-title-error">${errors.title}</p>`
            : ''}
        </div>
        <div class="form-control">
          <label class="label" for="favorite-url">
            <span class="label-text font-semibold text-base-content">Web address</span>
          </label>
          <input
            class="input input-bordered w-full rounded-xl ${errors.url ? 'input-error' : ''}"
            id="favorite-url"
            type="url"
            name="url"
            value="${values.url}"
            maxlength="2048"
            autocomplete="url"
            aria-describedby="${errors.url ? 'favorite-url-error' : 'favorite-url-help'}"
            required
          />
          ${errors.url
            ? html`<p class="critical-text mt-2 text-sm" id="favorite-url-error">${errors.url}</p>`
            : html`<p class="mt-2 text-sm text-base-content/75" id="favorite-url-help">
                If this changes, choose whether to keep or refresh the automatic icon below.
              </p>`}
        </div>
        <label class="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-base-300 p-4">
          <span>
            <span class="block font-medium">Show on portal</span>
            <span class="mt-1 block text-sm text-base-content/75">
              Hidden favorites stay in admin but do not appear on the homepage.
            </span>
          </span>
          <input
            class="toggle toggle-primary"
            type="checkbox"
            name="enabled"
            value="1"
            ${values.enabled ? 'checked' : ''}
          />
        </label>
        <fieldset class="space-y-3">
          <legend class="font-semibold">Icon</legend>
          <div class="rounded-2xl border border-base-300 p-4">
            <label class="flex cursor-pointer items-start gap-3">
              <input
                class="radio radio-primary mt-0.5"
                type="radio"
                name="iconMode"
                value="auto"
                ${values.iconMode === 'auto' ? 'checked' : ''}
              />
              <span>
                <span class="block font-medium">Automatic</span>
                <span class="mt-1 block text-sm text-base-content/75">
                  Use an icon supplied by the website.
                </span>
              </span>
            </label>
            <div class="mt-4 space-y-2 border-l-2 border-base-300 pl-5">
              <label class="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  class="radio radio-primary radio-sm mt-0.5"
                  type="radio"
                  name="automaticIconAction"
                  value="keep"
                  ${values.automaticIconAction === 'keep' ? 'checked' : ''}
                />
                <span><strong>Keep current icon</strong>, even if the web address changed.</span>
              </label>
              <label class="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  class="radio radio-primary radio-sm mt-0.5"
                  type="radio"
                  name="automaticIconAction"
                  value="refresh"
                  ${values.automaticIconAction === 'refresh' ? 'checked' : ''}
                />
                <span><strong>Find icon from web address</strong> when changes are saved.</span>
              </label>
            </div>
            ${errors.automaticIconAction
              ? html`<p class="critical-text mt-3 text-sm">${errors.automaticIconAction}</p>`
              : ''}
          </div>
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
              <span class="mt-1 block text-sm text-base-content/75">
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
              <span class="mt-1 block text-sm text-base-content/75">
                ${favorite.iconMode === 'upload'
                  ? 'Leave empty to keep the current upload, or choose a replacement.'
                  : 'Choose a PNG, JPEG, or WebP image up to 2 MB.'}
              </span>
              <input
                class="file-input file-input-bordered mt-3 w-full rounded-xl"
                type="file"
                name="iconFile"
                accept="image/png,image/jpeg,image/webp"
                data-custom-icon-input
                aria-describedby="${errors.iconFile ? 'favorite-icon-file-error' : undefined}"
              />
              <div
                class="mt-4"
                data-upload-icon-preview
                aria-live="polite"
                hidden
              ></div>
            </span>
          </label>
          ${errors.iconFile
            ? html`<p class="critical-text text-sm" id="favorite-icon-file-error">${errors.iconFile}</p>`
            : ''}
          ${errors.iconMode
            ? html`<p class="critical-text text-sm" id="favorite-icon-mode-error">${errors.iconMode}</p>`
            : ''}
        </fieldset>
        <div class="rounded-2xl bg-base-200 p-4">
          <h3 class="font-semibold">Current icon</h3>
          <div class="mt-4 flex items-center gap-4">
            ${await renderFavoriteIcon(favorite, 'admin')}
            <p class="text-sm text-base-content/75">
              This icon stays in place until you save a different choice.
            </p>
          </div>
        </div>
        <div
          class="rounded-2xl bg-base-200 p-4"
          data-automatic-icon-preview
          ${values.iconMode === 'auto' ? '' : 'hidden'}
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="font-semibold">Automatic icon preview</h3>
              <p class="mt-1 text-sm text-base-content/75">
                Check the icon available from the current web address.
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
              Preview automatic icon
            </button>
          </div>
          <div class="mt-4" id="favorite-icon-preview" aria-live="polite">
            <p class="text-sm text-base-content/75">
              Your current icon stays unless you select refresh and save changes.
            </p>
          </div>
          <span class="loading loading-spinner loading-sm htmx-indicator mt-3" id="favorite-preview-loading">
            <span class="sr-only">Loading preview</span>
          </span>
        </div>
        <div class="flex flex-wrap justify-end gap-3 pt-2">
          <a class="btn btn-ghost rounded-xl" href="/admin">Cancel</a>
          <button class="btn btn-primary rounded-xl" type="submit">Save Changes</button>
        </div>
      </form>
    </section>
  `
}

export async function renderEditFavoriteSuccess(
  favorite: Favorite,
  cleanupFailed = false,
  includeDashboardRow = true,
): Promise<HtmlEscapedString> {
  return html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      id="favorite-form-shell"
      data-favorite-form-shell
      ${cleanupFailed ? '' : html`data-auto-dismiss="4500"`}
    >
      <div class="alert ${cleanupFailed ? 'alert-warning' : 'alert-success'}" role="status">
        <span>
          <strong>${favorite.title}</strong> was updated.${cleanupFailed
            ? ' The previous uploaded icon could not be cleaned up automatically.'
            : ''}
        </span>
      </div>
      ${cleanupFailed
        ? html`<div class="mt-5 flex justify-end">
            <a class="btn btn-primary rounded-xl" href="/admin">Return to Admin</a>
          </div>`
        : ''}
    </section>
    ${includeDashboardRow
      ? await renderAdminFavoriteRow(favorite, { oob: true })
      : ''}
  `
}
