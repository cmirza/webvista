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
nvm use
npm install
npm run dev
```

The development command applies pending migrations to a local D1 database, then runs Wrangler and the Tailwind watcher together. Browser dependencies are self-hosted from `/assets`; no CDN is required. Local D1 data is kept under `.wrangler/state` and is not committed.

Useful checks:

```sh
npm run typecheck
npm test
npm run build
npm run db:seed:local
npm run db:status:local
npm run db:inspect:local
```

`wrangler types` generates Worker runtime and binding types from `wrangler.jsonc`; `npm run typecheck` refreshes them automatically.

The asset build compiles `src/styles/app.css` with Tailwind CSS and daisyUI, then copies pinned HTMX and SortableJS distributions from `node_modules`. Generated files under `public/assets` are intentionally ignored by Git and rebuilt by `npm run build` and `npm run deploy`.

`wrangler.jsonc` uses a non-production placeholder for the D1 database ID. Creating a Cloudflare D1 resource and replacing that value are intentionally deferred to the deployment milestone; local commands do not access a remote database.

`npm run db:seed:local` adds 12 idempotent example favorites to the local database so the portal grid can be exercised before the admin interface is available. It never targets the remote database.

## Project status

The server-rendered portal is runnable locally with Google search, a responsive D1-backed favorites grid, and a deliberately closed admin boundary. Favorites support validated persistence plus bounded, SSRF-conscious website metadata and icon discovery. Single-password admin authentication is the next implementation phase. See [PLAN.md](PLAN.md) for the active checklist, roadmap, decisions, and definition of done.

Contributors and coding agents must read [AGENTS.md](AGENTS.md) before changing the project.
