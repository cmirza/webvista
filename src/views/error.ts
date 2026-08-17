import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { renderLayout } from './layout'

const adminMessage =
  'WebVista could not complete that request. Return to Admin and check the saved state before trying again.'

export async function renderAdminServiceError(
  enhanced = false,
): Promise<HtmlEscapedString> {
  const notice = await html`
    <section
      class="rounded-3xl bg-base-100 p-5 shadow-sm sm:p-7"
      role="alert"
      data-service-error
    >
      <div class="alert alert-error">
        <span>${adminMessage}</span>
      </div>
      <div class="mt-5 flex justify-end">
        <a class="btn btn-primary rounded-xl" href="/admin">Return to Admin</a>
      </div>
    </section>
  `

  if (enhanced) {
    return notice
  }

  return renderLayout({
    children: await html`
      <main class="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
        <p class="brand-eyebrow mb-3 text-sm font-semibold tracking-[0.16em] uppercase">
          WebVista
        </p>
        <h1 class="mb-6 text-3xl font-semibold tracking-tight">Request unavailable</h1>
        ${notice}
      </main>
    `,
    description: 'WebVista administration request unavailable',
    robots: 'noindex,nofollow',
    title: 'Request unavailable · WebVista',
  })
}

export async function renderPortalServiceError(): Promise<HtmlEscapedString> {
  return renderLayout({
    children: await html`
      <main class="grid min-h-screen place-items-center px-6 py-12">
        <section class="w-full max-w-xl rounded-3xl bg-base-100 p-8 text-center shadow-sm sm:p-10">
          <p class="brand-eyebrow text-sm font-semibold tracking-[0.16em] uppercase">WebVista</p>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight">Temporarily unavailable</h1>
          <p class="mt-4 text-base-content/75">
            Favorites could not be loaded. Please try again shortly.
          </p>
          <a class="btn btn-primary mt-6 rounded-xl" href="/">Try again</a>
        </section>
      </main>
    `,
    description: 'WebVista is temporarily unavailable',
    title: 'Temporarily unavailable · WebVista',
  })
}
