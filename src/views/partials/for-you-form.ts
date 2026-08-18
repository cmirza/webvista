import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import type { ForYouItem } from '../../services/for-you'
import { renderAdminForYouRow } from './admin-for-you-row'

export interface ForYouFormValues {
  url: string
  title: string
  description: string
  imageUrl: string
  sourceName: string
  enabled?: boolean
}

interface FormOptions {
  enhanced?: boolean
  errors?: Record<string, string>
  item?: ForYouItem
  metadataNotice?: string
  metadataWarning?: string
  values?: Partial<ForYouFormValues>
}

const errorMessage = async (
  errors: Record<string, string>,
  field: string,
): Promise<HtmlEscapedString | string> =>
  errors[field]
    ? html`<p class="mt-2 text-sm critical-text" id="${field}-error">${errors[field]}</p>`
    : ''

export async function renderForYouForm({
  enhanced = false,
  errors = {},
  item,
  metadataNotice,
  metadataWarning,
  values = {},
}: FormOptions = {}): Promise<HtmlEscapedString> {
  const editing = Boolean(item)
  const resolved = {
    url: values.url ?? item?.url ?? '',
    title: values.title ?? item?.title ?? '',
    description: values.description ?? item?.description ?? '',
    imageUrl: values.imageUrl ?? item?.imageUrl ?? '',
    sourceName: values.sourceName ?? item?.sourceName ?? '',
    enabled: values.enabled ?? item?.enabled ?? true,
  }
  const action = item ? `/admin/for-you/${item.id}` : '/admin/for-you'

  return html`
    <section
      class="rounded-3xl bg-base-100 p-6 shadow-sm sm:p-8"
      id="for-you-form-shell"
      data-for-you-form-shell
    >
      <p class="brand-eyebrow text-sm font-semibold tracking-[0.16em] uppercase">For You</p>
      <h2 class="mt-1 text-3xl font-semibold tracking-tight">${editing ? 'Edit Link' : 'Add Link'}</h2>
      <p class="mt-3 text-base-content/75">
        ${editing
          ? 'Update how this link appears in the portal carousel.'
          : 'Paste an article, video, or other webpage. Preview fills in details that you can edit before saving.'}
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
        ${enhanced
          ? html`hx-post="${action}"
              hx-target="#for-you-form-shell"
              hx-swap="outerHTML"`
          : ''}
      >
        ${enhanced
          ? html`<input type="hidden" name="presentation" value="dashboard" />`
          : ''}
        <label class="form-control block">
          <span class="label-text mb-2 block font-semibold">Web address</span>
          <div class="flex flex-col gap-3 sm:flex-row">
            <input
              class="input input-bordered input-lg min-w-0 flex-1 rounded-xl"
              type="url"
              name="url"
              value="${resolved.url}"
              placeholder="https://example.com/story"
              maxlength="2048"
              aria-describedby="${errors.url ? 'url-error' : undefined}"
              required
            />
            ${editing
              ? ''
              : enhanced
                ? html`<button
                    class="btn btn-outline rounded-xl"
                    type="button"
                    data-for-you-preview-button
                    hx-get="/admin/for-you/preview"
                    hx-include="closest form"
                    hx-target="#for-you-form-shell"
                    hx-swap="outerHTML"
                  >
                    Preview Link
                  </button>`
                : html`<button
                    class="btn btn-outline rounded-xl"
                    type="submit"
                    data-for-you-preview-button
                    formmethod="get"
                    formaction="/admin/for-you/preview"
                    formnovalidate
                  >
                    Preview Link
                  </button>`}
          </div>
          ${await errorMessage(errors, 'url')}
        </label>

        <div class="grid gap-6 sm:grid-cols-2">
          <label class="form-control block sm:col-span-2">
            <span class="label-text mb-2 block font-semibold">Title</span>
            <input class="input input-bordered w-full rounded-xl" name="title" value="${resolved.title}" maxlength="200" required />
            ${await errorMessage(errors, 'title')}
          </label>
          <label class="form-control block">
            <span class="label-text mb-2 block font-semibold">Source</span>
            <input class="input input-bordered w-full rounded-xl" name="sourceName" value="${resolved.sourceName}" maxlength="100" placeholder="Example News" required />
            ${await errorMessage(errors, 'sourceName')}
          </label>
          <label class="form-control block">
            <span class="label-text mb-2 block font-semibold">Image address <span class="font-normal text-base-content/60">(optional)</span></span>
            <input class="input input-bordered w-full rounded-xl" type="url" name="imageUrl" value="${resolved.imageUrl}" maxlength="2048" placeholder="https://example.com/image.jpg" />
            ${await errorMessage(errors, 'imageUrl')}
          </label>
          <label class="form-control block sm:col-span-2">
            <span class="label-text mb-2 block font-semibold">Description <span class="font-normal text-base-content/60">(optional)</span></span>
            <textarea class="textarea textarea-bordered min-h-28 w-full rounded-xl" name="description" maxlength="500">${resolved.description}</textarea>
            ${await errorMessage(errors, 'description')}
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
                  <span class="block font-semibold">Show this link</span>
                  <span class="block text-sm text-base-content/75">Hidden links stay saved but do not appear in the portal carousel.</span>
                </span>
              </label>`
            : ''}
        </div>

        <div class="flex flex-wrap justify-end gap-3 pt-2">
          <a class="btn btn-ghost rounded-xl" href="/admin">Cancel</a>
          <button class="btn btn-primary rounded-xl" type="submit">${editing ? 'Save Changes' : 'Add to For You'}</button>
        </div>
      </form>
    </section>
  `
}

export async function renderAddForYouSuccess(
  item: ForYouItem,
  total: number,
): Promise<HtmlEscapedString> {
  return html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      id="for-you-form-shell"
      data-for-you-form-shell
      data-auto-dismiss="4500"
    >
      <div class="alert alert-success" role="status">
        <span><strong>${item.title}</strong> was added to For You.</span>
      </div>
      <div class="mt-5 flex flex-wrap justify-end gap-3">
        <button
          class="btn btn-primary rounded-xl"
          type="button"
          hx-get="/admin/for-you/new"
          hx-target="#for-you-form-shell"
          hx-swap="outerHTML"
        >
          Add another
        </button>
      </div>
    </section>
    <div hx-swap-oob="afterbegin:#admin-for-you-list">
      ${await renderAdminForYouRow(item)}
    </div>
    <span
      class="badge badge-ghost"
      id="for-you-count"
      aria-label="${total} For You links"
      hx-swap-oob="outerHTML"
    >${total}</span>
    <div id="admin-for-you-empty-state" hx-swap-oob="delete"></div>
  `
}

export async function renderEditForYouSuccess(
  item: ForYouItem,
  includeDashboardRow = true,
): Promise<HtmlEscapedString> {
  return html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      id="for-you-form-shell"
      data-for-you-form-shell
      data-auto-dismiss="4500"
    >
      <div class="alert alert-success" role="status">
        <span><strong>${item.title}</strong> was updated.</span>
      </div>
    </section>
    ${includeDashboardRow
      ? await renderAdminForYouRow(item, { oob: true })
      : ''}
  `
}

export async function renderDeleteForYouConfirmation(
  item: ForYouItem,
  enhanced = false,
): Promise<HtmlEscapedString> {
  return html`
    <section
      class="rounded-3xl bg-base-100 p-6 shadow-sm sm:p-8"
      id="for-you-delete-shell"
      data-for-you-delete-shell
    >
      <p class="brand-eyebrow text-sm font-semibold tracking-[0.16em] uppercase">For You</p>
      <h2 class="mt-1 text-3xl font-semibold tracking-tight">Remove Link?</h2>
      <p class="mt-4 text-lg">Remove <strong>${item.title}</strong> from For You?</p>
      <form
        class="mt-8 flex justify-end gap-3"
        method="post"
        action="/admin/for-you/${item.id}/delete"
        ${enhanced
          ? html`hx-delete="/admin/for-you/${item.id}"
              hx-target="#for-you-delete-shell"
              hx-swap="outerHTML"`
          : ''}
      >
        <input type="hidden" name="confirmed" value="yes" />
        ${enhanced
          ? html`<input type="hidden" name="presentation" value="dashboard" />`
          : ''}
        <a class="btn btn-ghost rounded-xl" href="/admin">Cancel</a>
        <button class="btn btn-error rounded-xl" type="submit">Remove Link</button>
      </form>
    </section>
  `
}

export async function renderDeleteForYouSuccess(
  item: ForYouItem,
  total: number,
): Promise<HtmlEscapedString> {
  return html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      id="for-you-delete-shell"
      data-for-you-delete-shell
      data-auto-dismiss="4500"
    >
      <div class="alert alert-success" role="status">
        <span><strong>${item.title}</strong> was removed.</span>
      </div>
    </section>
    <li id="admin-for-you-${item.id}" hx-swap-oob="delete"></li>
    <span
      class="badge badge-ghost"
      id="for-you-count"
      aria-label="${total} For You links"
      hx-swap-oob="outerHTML"
    >${total}</span>
    ${total === 0
      ? html`<div
          class="mt-4 rounded-2xl border border-dashed border-base-300 px-6 py-10 text-center"
          id="admin-for-you-empty-state"
          hx-swap-oob="afterend:#admin-for-you-list"
        >
          <h3 class="font-semibold">No links yet</h3>
          <p class="mt-2 text-sm text-base-content/75">Add a story, video, or webpage to start the carousel.</p>
        </div>`
      : ''}
  `
}
