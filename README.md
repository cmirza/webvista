# WebVista

WebVista is a lightweight personal web portal designed to work as a browser home page. It favors large, obvious controls, minimal navigation, and genuinely useful information without becoming a traditional dashboard.

The first release has one job: determine whether the portal earns a place in everyday browsing. It will provide Google search and a polished, responsive grid of favorite sites, with administration kept behind a separate authenticated interface.

## Product principles

- Keep the user-facing experience extremely simple.
- Prefer server-rendered HTML over client-side application complexity.
- Build incrementally and validate real usage before expanding.
- Optimize for desktop and split-screen use first.
- Keep administration separate from the portal.
- Avoid abstractions until they solve a current problem.
- Stay compatible with Cloudflare's free tier.

## Planned stack

- Cloudflare Workers and Hono
- Server-rendered HTML with HTMX
- Tailwind CSS and daisyUI using a customized light Nord theme
- Cloudflare D1 for structured data
- Cloudflare R2 when uploaded assets are introduced
- SortableJS for admin ordering
- A single password-protected admin session

## Local development

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Useful checks:

```sh
npm run typecheck
npm test
npm run build
```

`wrangler types` generates Worker runtime and binding types from `wrangler.jsonc`; `npm run typecheck` refreshes them automatically.

## Project status

The Cloudflare Workers and Hono foundation is in progress. See [PLAN.md](PLAN.md) for the active checklist, roadmap, decisions, and definition of done.

Contributors and coding agents must read [AGENTS.md](AGENTS.md) before changing the project.
