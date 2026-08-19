# WebVista

WebVista is a lightweight personal web portal designed to work as a browser home page. It favors large, obvious controls, minimal navigation, and genuinely useful information without becoming a traditional dashboard.

The first release has one job: determine whether the portal earns a place in everyday browsing. It provides Google search and a polished, responsive grid of favorite sites, with administration kept behind a separate authenticated interface. The current Watch work builds on the completed curated For You row with a poster-based row for directly linked movies and TV shows.

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
- Cloudflare R2 for uploaded custom icons
- SortableJS for admin ordering
- A single password-protected admin session

## Local development

Use Node.js 22.12 or newer.

```sh
nvm use
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Before starting, replace the authentication values in `.dev.vars`: `ADMIN_PASSWORD` is the login password and `ADMIN_SESSION_SECRET` is a separate, long random value used only to sign sessions. To enable Watch metadata previews, add a TMDb API Read Access Token as `TMDB_API_TOKEN`; manual Watch entry remains available without it. Neither `.dev.vars` nor its contents should be committed. The development command applies pending migrations to a local D1 database, then runs Wrangler and the Tailwind watcher together. Browser dependencies are self-hosted from `/assets`; no CDN is required. Local D1 data is kept under `.wrangler/state` and is not committed.

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

## Production deployment

WebVista is deployed at [webvista.cc](https://webvista.cc). Its production `workers.dev` route is disabled so the custom domain is the only public production origin.

Production uses an ignored `wrangler.production.jsonc` file so Cloudflare resource identifiers never enter the public repository. To configure another deployment:

1. Copy `wrangler.production.example.jsonc` to `wrangler.production.jsonc`.
2. Create a D1 database and replace the placeholder database ID in the ignored file.
3. Create the configured R2 bucket.
4. Apply migrations with `wrangler d1 migrations apply webvista --remote --config wrangler.production.jsonc`.
5. Store `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `TMDB_API_TOKEN` with `wrangler secret put`, or upload an ignored dotenv file with `wrangler secret bulk`.
6. Configure the custom domain route, keep `workers_dev` set to `false`, then run `npm run deploy`.

After deployment, run the cleanup-safe production check:

```sh
npm run smoke:production -- https://your-custom-domain.example
```

The check reads the admin password from the ignored `.dev.vars`, exercises authentication, CRUD, ordering, and R2 icon storage, then removes its temporary favorite and uploaded icon.

## Project status

The server-rendered v1.0 portal is deployed with Google search, a responsive D1-backed favorites grid, and a single-password authenticated admin area. Favorites can open websites or registered application links such as `weather://`; browser-executable and internal URL schemes remain blocked. The admin can add, edit, remove, and reorder validated favorites through normal HTML or an HTMX-enhanced dashboard flow, including automatic metadata/icon discovery, generated fallbacks, enabled/hidden state, custom icon uploads backed by R2, and keyboard-accessible ordering controls.

The deployed For You feature supports authenticated link creation with safe Open Graph previews, editable saved metadata and visibility, newest-first insertion, removal, server-authoritative drag/keyboard ordering, a persisted show/hide control, and a one-row scroll-snapped portal carousel. Preview discovery reads a bounded HTML prefix and uses first-party fallbacks for YouTube, NYT, Bloomberg, KGW, and publisher AMP pages when ordinary server retrieval is unavailable; fully blocked pages receive a clearly labeled editable title/source generated from their URL. An authenticated bookmarklet can capture the standard preview fields already visible to the browser and open an editable WebVista preview without re-fetching a blocked publisher.

The deployed Watch feature adds D1 persistence and authenticated Add, Edit, Hide, Remove, and ordering flows, including a direct web or registered application link and an optional IMDb/TMDb identifier. With a server-side TMDb API read token, the form retrieves an editable title, year, movie/TV type, and poster preview before saving; manual entry remains available without the integration. Enabled titles appear in a single horizontally browsable poster row above For You, with the service shown beneath unobstructed poster art. Admin ordering supports pointer dragging and keyboard-accessible Move controls, with D1 authoritative for the portal order. See [PLAN.md](PLAN.md) for the active checklist, roadmap, decisions, and definition of done.

The deployed date/weather increment adds a browser-local weekday/date plus current conditions and the day's high/low from Open-Meteo. Weather always uses a fixed Portland 97209-area location, requires no browser location permission, and caches retrievals within free-tier constraints.

Contributors and coding agents must read [AGENTS.md](AGENTS.md) before changing the project.
