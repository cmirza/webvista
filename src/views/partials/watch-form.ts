import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { WatchItem } from '../../services/watch'
import { renderAdminWatchRow } from './admin-watch-row'

export interface WatchFormValues {
  metadataId: string
  title: string
  year: string
  mediaType: string
  posterUrl: string
  serviceName: string
  watchUrl: string
  enabled?: boolean
}

interface WatchFormOptions {
  errors?: Record<string, string>
  enhanced?: boolean
  item?: WatchItem
  metadataNotice?: string
  metadataWarning?: string
  values?: Partial<WatchFormValues>
}

const errorMessage = async (
  errors: Record<string, string>,
  field: string,
): Promise<HtmlEscapedString | string> =>
  errors[field]
    ? html`<p class="mt-2 text-sm critical-text" id="${field}-error">${errors[field]}</p>`
    : ''

export async function renderWatchForm({
  errors = {},
  enhanced = false,
  item,
  metadataNotice,
  metadataWarning,
  values = {},
}: WatchFormOptions = {}): Promise<HtmlEscapedString> {
  const editing = Boolean(item)
  const resolved: WatchFormValues = {
    metadataId:
      values.metadataId ??
      item?.imdbId ??
      (item?.tmdbId ? `${item.mediaType}/${item.tmdbId}` : ''),
    title: values.title ?? item?.title ?? '',
    year: values.year ?? item?.year?.toString() ?? '',
    mediaType: values.mediaType ?? item?.mediaType ?? 'movie',
    posterUrl: values.posterUrl ?? item?.posterUrl ?? '',
    serviceName: values.serviceName ?? item?.serviceName ?? '',
    watchUrl: values.watchUrl ?? item?.watchUrl ?? '',
    enabled: values.enabled ?? item?.enabled ?? true,
  }
  const action = item ? `/admin/watch/${item.id}` : '/admin/watch'

  return html`
    <section class="rounded-3xl bg-base-100 p-6 shadow-sm sm:p-8" id="watch-form-shell">
      <p class="brand-eyebrow text-sm font-semibold tracking-[0.16em] uppercase">Watch</p>
      <h2 class="mt-1 text-3xl font-semibold tracking-tight">${editing ? 'Edit Title' : 'Add Title'}</h2>
      <p class="mt-3 text-base-content/75">
        ${editing
          ? 'Update how this title appears and where it opens.'
          : 'Look up an IMDb or TMDb title, then add the direct link for the service where it should open.'}
      </p>
      ${metadataWarning
        ? html`<div class="alert alert-warning mt-6" role="status">${metadataWarning}</div>`
        : ''}
      ${metadataNotice
        ? html`<div class="alert alert-info mt-6" role="status">${metadataNotice}</div>`
        : ''}
      <form
        class="mt-7 space-y-6"
        method="post"
        action="${action}"
        ${enhanced && editing
          ? html`hx-post="${action}" hx-target="#watch-form-shell" hx-swap="outerHTML"`
          : ''}
      >
        ${enhanced && editing ? html`<input type="hidden" name="presentation" value="dashboard" />` : ''}
        <div class="grid gap-6 sm:grid-cols-2">
          <label class="form-control block sm:col-span-2">
            <span class="label-text mb-2 block font-semibold">IMDb or TMDb ID <span class="font-normal text-base-content/60">(optional)</span></span>
            <div class="flex flex-col gap-3 sm:flex-row">
              <input class="input input-bordered input-lg min-w-0 flex-1 rounded-xl" name="metadataId" value="${resolved.metadataId}" maxlength="200" placeholder="tt0137523, movie/550, or a title URL" />
              ${editing
                ? ''
                : enhanced
                  ? html`<button
                      class="btn btn-outline rounded-xl"
                      type="button"
                      data-watch-preview-button
                      hx-get="/admin/watch/preview"
                      hx-include="closest form"
                      hx-target="#watch-form-shell"
                      hx-swap="outerHTML"
                    >
                      Preview Details
                    </button>`
                  : html`<button
                      class="btn btn-outline rounded-xl"
                      type="submit"
                      data-watch-preview-button
                      formmethod="get"
                      formaction="/admin/watch/preview"
                      formnovalidate
                    >
                      Preview Details
                    </button>`}
            </div>
            <span class="mt-2 block text-sm text-base-content/75">A plain numeric TMDb ID uses the selected Movie or TV show type.</span>
            ${await errorMessage(errors, 'metadataId')}
          </label>
          <label class="form-control block sm:col-span-2">
            <span class="label-text mb-2 block font-semibold">Title</span>
            <input class="input input-bordered w-full rounded-xl" name="title" value="${resolved.title}" maxlength="200" required />
            ${await errorMessage(errors, 'title')}
          </label>
          ${resolved.posterUrl || metadataNotice
            ? html`<div class="rounded-2xl bg-base-200 p-4 sm:col-span-2">
                <p class="font-semibold">Preview</p>
                <div class="mt-3 flex min-w-0 items-center gap-4">
                  <div class="admin-watch-poster" aria-hidden="true">
                    <span>${resolved.title.trim().charAt(0).toUpperCase() || 'W'}</span>
                    ${resolved.posterUrl
                      ? html`<img src="${resolved.posterUrl}" alt="" referrerpolicy="no-referrer" />`
                      : ''}
                  </div>
                  <div class="min-w-0">
                    <p class="truncate font-semibold">${resolved.title || 'Untitled'}</p>
                    <p class="truncate text-sm text-base-content/75">
                      ${resolved.serviceName || 'Streaming service'}${resolved.year ? ` · ${resolved.year}` : ''} · ${resolved.mediaType === 'tv' ? 'TV Show' : 'Movie'}
                    </p>
                  </div>
                </div>
              </div>`
            : ''}
          <label class="form-control block">
            <span class="label-text mb-2 block font-semibold">Year <span class="font-normal text-base-content/60">(optional)</span></span>
            <input class="input input-bordered w-full rounded-xl" type="number" name="year" value="${resolved.year}" min="1888" max="2100" inputmode="numeric" />
            ${await errorMessage(errors, 'year')}
          </label>
          <label class="form-control block">
            <span class="label-text mb-2 block font-semibold">Type</span>
            <select class="select select-bordered w-full rounded-xl" name="mediaType" required>
              <option value="movie" ${resolved.mediaType === 'movie' ? 'selected' : ''}>Movie</option>
              <option value="tv" ${resolved.mediaType === 'tv' ? 'selected' : ''}>TV show</option>
            </select>
            ${await errorMessage(errors, 'mediaType')}
          </label>
          <label class="form-control block">
            <span class="label-text mb-2 block font-semibold">Streaming service</span>
            <input class="input input-bordered w-full rounded-xl" name="serviceName" value="${resolved.serviceName}" maxlength="100" list="streaming-services" placeholder="Netflix" required />
            <datalist id="streaming-services">
              <option value="Plex"></option>
              <option value="Netflix"></option>
              <option value="Prime Video"></option>
              <option value="Apple TV"></option>
              <option value="Disney+"></option>
              <option value="Max"></option>
              <option value="Hulu"></option>
              <option value="YouTube"></option>
            </datalist>
            ${await errorMessage(errors, 'serviceName')}
          </label>
          <label class="form-control block">
            <span class="label-text mb-2 block font-semibold">Direct watch address</span>
            <input class="input input-bordered w-full rounded-xl" name="watchUrl" value="${resolved.watchUrl}" maxlength="2048" placeholder="https://www.netflix.com/title/..." required />
            ${await errorMessage(errors, 'watchUrl')}
          </label>
          <label class="form-control block sm:col-span-2">
            <span class="label-text mb-2 block font-semibold">Poster image address <span class="font-normal text-base-content/60">(optional)</span></span>
            <input class="input input-bordered w-full rounded-xl" type="url" name="posterUrl" value="${resolved.posterUrl}" maxlength="2048" placeholder="https://image.example/poster.jpg" />
            <span class="mt-2 block text-sm text-base-content/75">Leave this blank for a generated title initial.</span>
            ${await errorMessage(errors, 'posterUrl')}
          </label>
          ${editing
            ? html`<label class="flex cursor-pointer items-center gap-3 sm:col-span-2">
                <input
                  class="toggle toggle-primary"
                  type="checkbox"
                  name="enabled"
                  value="1"
                  ${resolved.enabled ? 'checked' : ''}
                />
                <span>
                  <span class="block font-semibold">Show this title</span>
                  <span class="block text-sm text-base-content/75">Hidden titles stay saved but do not appear in the portal row.</span>
                </span>
              </label>`
            : ''}
        </div>
        <div class="flex flex-wrap justify-end gap-3 pt-2">
          <a class="btn btn-ghost rounded-xl" href="/admin">Cancel</a>
          <button class="btn btn-primary rounded-xl" type="submit">${editing ? 'Save Changes' : 'Add to Watch'}</button>
        </div>
      </form>
    </section>
  `
}

export async function renderEditWatchSuccess(
  item: WatchItem,
): Promise<HtmlEscapedString> {
  return html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      id="watch-form-shell"
      data-auto-dismiss="4500"
    >
      <div class="alert alert-success" role="status">
        <span><strong>${item.title}</strong> was updated.</span>
      </div>
    </section>
    ${await renderAdminWatchRow(item, { oob: true })}
  `
}

export async function renderDeleteWatchConfirmation(
  item: WatchItem,
  enhanced = false,
): Promise<HtmlEscapedString> {
  return html`
    <section class="rounded-3xl bg-base-100 p-6 shadow-sm sm:p-8" id="watch-delete-shell">
      <p class="brand-eyebrow text-sm font-semibold tracking-[0.16em] uppercase">Watch</p>
      <h2 class="mt-1 text-3xl font-semibold tracking-tight">Remove Title?</h2>
      <p class="mt-4 text-lg">Remove <strong>${item.title}</strong> from Watch?</p>
      <form
        class="mt-8 flex justify-end gap-3"
        method="post"
        action="/admin/watch/${item.id}/delete"
        ${enhanced
          ? html`hx-delete="/admin/watch/${item.id}" hx-target="#watch-delete-shell" hx-swap="outerHTML"`
          : ''}
      >
        <input type="hidden" name="confirmed" value="yes" />
        <a class="btn btn-ghost rounded-xl" href="/admin">Cancel</a>
        <button class="btn btn-error rounded-xl" type="submit">Remove Title</button>
      </form>
    </section>
  `
}

export async function renderDeleteWatchSuccess(
  item: WatchItem,
  total: number,
): Promise<HtmlEscapedString> {
  return html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      id="watch-delete-shell"
      data-auto-dismiss="4500"
    >
      <div class="alert alert-success" role="status">
        <span><strong>${item.title}</strong> was removed.</span>
      </div>
    </section>
    <li id="admin-watch-${item.id}" hx-swap-oob="delete"></li>
    <span
      class="badge badge-ghost"
      id="watch-count"
      aria-label="${total} Watch titles"
      hx-swap-oob="outerHTML"
    >${total}</span>
    ${total === 0
      ? html`<div
          class="mt-4 rounded-2xl border border-dashed border-base-300 px-6 py-10 text-center"
          id="admin-watch-empty-state"
          hx-swap-oob="afterend:#admin-watch-list"
        >
          <h3 class="font-semibold">Nothing to watch yet</h3>
          <p class="mt-2 text-sm text-base-content/75">Add a movie or TV show with its direct streaming link.</p>
        </div>`
      : ''}
  `
}
