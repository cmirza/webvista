import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'

type LayoutOptions = {
  children: HtmlEscapedString
  description: string
  robots?: 'index,follow' | 'noindex,nofollow'
  title: string
}

export async function renderLayout({
  children,
  description,
  robots = 'index,follow',
  title,
}: LayoutOptions): Promise<HtmlEscapedString> {
  return html`<!doctype html>
    <html lang="en" data-theme="nord">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="${description}" />
        <meta name="robots" content="${robots}" />
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#eceff4" />
        <title>${title}</title>
        <link rel="stylesheet" href="/assets/app.css" />
        <script src="/assets/htmx.min.js" defer></script>
      </head>
      <body class="bg-base-200 text-base-content">
        ${children}
      </body>
    </html>`
}
