import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { renderLayout } from './layout'

export async function renderAdminUnavailable(): Promise<HtmlEscapedString> {
  const content = await html`
    <main class="grid min-h-screen place-items-center px-6 py-12">
      <section class="w-full max-w-lg rounded-3xl bg-base-100 p-8 text-center shadow-sm sm:p-10">
        <p class="mb-3 text-sm font-semibold tracking-[0.16em] text-primary uppercase">
          WebVista Admin
        </p>
        <h1 class="text-3xl font-semibold tracking-tight">Administration is not available yet.</h1>
        <p class="mt-4 leading-7 text-base-content/65">
          This area stays closed until password and session authentication are configured.
        </p>
        <a class="btn btn-primary mt-8 rounded-xl" href="/">Return to WebVista</a>
      </section>
    </main>
  `

  return renderLayout({
    children: content,
    description: 'WebVista administration',
    robots: 'noindex,nofollow',
    title: 'Admin unavailable · WebVista',
  })
}
