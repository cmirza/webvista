# WebVista Delivery Plan

WebVista is a lightweight personal portal whose first release answers one question: **Will people actually use this as their browser home/start page?**

This file is the source of truth for scope and progress. Add newly discovered work beneath the relevant checkbox, and check work off only after it has been implemented and verified.

## Status

- Active milestone: **v1.0 — Favorites MVP**
- Implementation status: **Deployed**
- Current phase: **Production validation checkpoint**
- Next task: **Complete a user-led production portal and admin walkthrough**

## Core principles

- Keep the user-facing experience extremely simple.
- Prefer server-rendered HTML over client-side application complexity.
- Build incrementally and validate actual usage before expanding.
- Optimize for desktop and split-screen use first.
- Keep administration separate from the portal UI.
- Avoid unnecessary abstractions until the application requires them.
- Target Cloudflare's free tier for hosting.

## Architecture direction

```text
Browser
   │
   ▼
Cloudflare Worker
   │
   ▼
Hono
 ├── Portal routes
 ├── Admin routes
 ├── HTMX partial routes
 └── External service integrations
        ├── Weather
        └── TMDb
   │
   ├──────────────┐
   ▼              ▼
  D1              R2
 data       uploaded assets
```

Planned stack:

- Runtime: Cloudflare Workers
- Framework: Hono with TypeScript
- Frontend: server-rendered HTML enhanced by HTMX
- Styling: Tailwind CSS and daisyUI
- Theme: customized Nord Light
- Database: Cloudflare D1
- File storage: Cloudflare R2 for uploaded custom icons
- Sorting: SortableJS
- Authentication: one admin password with a signed session cookie

## v1.0 — Favorites MVP

### 1. Project foundation

- [x] Initialize the application toolchain.
  - [x] Initialize the local Git repository when explicitly requested.
  - [x] Create the public GitHub repository and configure `origin` when explicitly requested.
  - [x] Scaffold a TypeScript Cloudflare Workers project using Hono.
  - [x] Configure npm scripts for local development, typechecking, testing, building, and deployment.
  - [x] Configure Wrangler without committing account-specific production identifiers.
  - [x] Pin the supported local Node.js runtime with `.nvmrc`.
  - [x] Add Tailwind CSS, daisyUI, HTMX, and SortableJS.
  - [x] Add `.gitignore` entries for dependencies, generated output, local D1/Wrangler state, secrets, and editor/OS files.
- [x] Establish the simple source layout.
  - [x] Add the Worker entry point and typed Cloudflare bindings.
  - [x] Add portal, admin, and authentication route modules.
  - [x] Add the shared layout and initial portal/admin views.
  - [x] Add the public favorite partial view.
  - [x] Add favorite-form and admin-row partial views with their features.
  - [x] Add the favorites service module.
  - [x] Add the icon service module.
  - [x] Add authentication middleware.
  - [x] Add the main stylesheet and asset pipeline.
- [x] Add a minimal automated test harness suitable for Hono Worker routes.
- [x] Confirm the starter application runs locally and produces a deployable Worker build.

Target structure, subject to small changes that reduce complexity:

```text
src/
├── index.ts
├── routes/
│   ├── portal.ts
│   ├── admin.ts
│   └── auth.ts
├── views/
│   ├── layout.ts
│   ├── portal.ts
│   ├── admin.ts
│   └── partials/
│       ├── favorite.ts
│       ├── favorite-form.ts
│       └── admin-favorite-row.ts
├── services/
│   ├── favorites.ts
│   └── icons.ts
├── middleware/
│   └── auth.ts
└── styles/
    └── app.css

migrations/
└── 0001_initial.sql
```

### 2. D1 favorites persistence

- [x] Create the initial D1 migration.
  - [x] Add a `favorites` table with `id`, `title`, `url`, `position`, icon fields, `enabled`, and timestamps.
  - [x] Restrict stored `icon_mode` values to `auto`, `upload`, or `fallback` with a database constraint.
  - [x] Add an index supporting enabled/position queries.
- [x] Implement favorite list, lookup, create, update, delete, and reorder operations.
  - [x] Restrict `icon_mode` to `auto`, `upload`, or `fallback` at the application boundary.
  - [x] Normalize stored addresses and reject duplicate favorite URLs.
  - [x] Accept safe application URL schemes such as `weather://` while rejecting browser-executable and internal schemes.
  - [x] Require a complete, duplicate-free ID set before persisting a reorder.
- [x] Use stable text IDs and UTC ISO-8601 timestamps.
- [x] Assign default positions in increments of 10 and normalize positions after a complete reorder.
- [x] Verify migrations and persistence against a local D1 database.

Initial schema shape:

```sql
CREATE TABLE favorites (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    position INTEGER NOT NULL,
    icon_mode TEXT NOT NULL DEFAULT 'auto',
    icon_url TEXT,
    icon_storage_key TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### 3. Shared UI and Nord Light theme

- [x] Build the base HTML document with responsive metadata and shared assets.
- [x] Configure daisyUI's Nord theme and customize it into a light macOS-like start page.
- [x] Express colors, radii, shadows, spacing, and typography through theme variables or design tokens.
- [x] Use a cool-gray page background, light surfaces, Nord blue accents, charcoal text, soft shadows, and minimal borders.
- [x] Set a maximum content width and generous responsive page spacing.
- [x] Provide visible keyboard focus states and respect reduced-motion preferences.
- [x] Do not add dark mode in v1.0.

### 4. Public portal

- [x] Implement `GET /` as server-rendered HTML.
- [x] Use a friendly, neutral static introduction without personalized or timezone-dependent copy.
- [x] Add prominent Google search above Favorites.
  - [x] Submit with `GET https://www.google.com/search` and a `q` field.
  - [x] Provide a large search input, clear focus state, and visible submit button.
  - [x] Add an accessible multicolor visual prompt that disappears during entry.
  - [x] Verify Enter submits and search works without JavaScript.
- [x] Render enabled favorites ordered by stored position.
- [x] Make the entire icon/name region a same-tab external link.
- [x] Keep the portal free of admin controls, admin links, and navigation menus.
- [x] Handle an empty favorites list without exposing administration to portal users.

### 5. Responsive favorites grid

- [x] Display favorite icons at a consistent outer size of approximately 96–120px.
- [x] Use a width-driven CSS grid, based on `auto-fit`/`minmax`, rather than device detection.
- [x] Implement grid sizing intended to show roughly eight columns in a wide window, four at half-screen, and three when narrow.
- [x] Support at least 12 favorites without crowding or excessive stretching.
  - [x] Provide an idempotent local-only seed dataset with 12 representative favorites.
- [x] Clamp long titles to two lines without allowing one item to distort the grid.
- [x] Verify wide monitor, half-screen desktop, narrow desktop, tablet, and basic mobile fallback layouts.

### 6. Automatic and fallback icons

- [x] Implement safe, bounded website metadata retrieval for an entered URL.
- [x] Discover icon candidates in this order:
  - [x] Apple touch icon.
  - [x] Web app manifest icons.
  - [x] Highest-resolution favicon.
  - [x] Generated fallback.
- [x] Resolve relative icon and manifest URLs against the final page URL.
- [x] Prefer declared or inspected high-resolution assets and avoid enlarging tiny favicons when a better source exists.
- [x] Generate a consistent fallback using the favorite name.
- [x] Add timeouts, response-size limits, content-type checks, and graceful failure behavior.
- [x] Prevent metadata retrieval from accessing unsafe local/private network targets.
- [x] Display every icon inside a consistent rounded macOS-style visual container.
- [x] Add unit tests for candidate priority, URL resolution, malformed metadata, and fallback generation.

### 7. Admin authentication

- [x] Implement `GET /admin/login` and a clear single-password login form.
- [x] Implement `POST /admin/login` using a password stored as a Cloudflare secret.
- [x] Compare credentials safely and issue a signed, secure session cookie.
- [x] Set appropriate `HttpOnly`, `Secure`, `SameSite`, path, and expiration attributes.
- [x] Implement `POST /admin/logout` and invalidate the browser session.
- [x] Protect every `/admin/*` route except login endpoints.
- [x] Protect every write endpoint on the server, regardless of HTMX usage.
  - [x] Reject cross-origin admin form submissions.
- [x] Verify rejected login, accepted login, tampered/expired cookie, logout, and unauthorized write behavior.
- [x] Do not build registration, recovery, multiple users, roles, or OAuth.

### 8. Admin dashboard

- [x] Implement authenticated `GET /admin`.
- [x] Add a simple header with a WebVista eyebrow, “Admin Panel,” a View Portal link, and logout action.
- [x] Render favorites as ordered rows with drag handle, icon, name, hostname, edit, and delete actions.
  - [x] Keep controls disabled until their corresponding mutation workflows are implemented.
- [x] Add a clear Add Favorite action and sorting instructions.
- [x] Use standard daisyUI components; do not spend custom-design effort intended for the public portal.
- [x] Keep the admin usable at narrower widths without implementing the v1.3 mobile-specific workflow.
- [x] Auto-dismiss successful HTMX add, edit, and delete confirmations without requiring a Done action.

### 9. Add favorite

- [x] Implement the add form and supporting HTMX routes.
- [x] Accept a manually editable display name and an absolute HTTP/HTTPS URL.
- [x] Normalize and validate form values on the server with field-level errors.
- [x] Fetch site metadata after URL entry and show the discovered title/icon preview.
- [x] Allow the manually entered title to override discovered metadata.
- [x] Let the admin select automatic, uploaded, or generated fallback icon mode.
  - [x] Enable automatic and generated fallback choices.
  - [x] Show the custom upload choice as unavailable until R2 support is implemented.
  - [x] Enable the custom upload choice with the validated R2 workflow.
  - [x] Confirm the selected-file preview and completed upload in the local browser checkpoint.
- [x] Save the favorite and insert the rendered row into the admin list without a full reload.
  - [x] Append the complete row element through an HTMX out-of-band swap and update the count/empty state.
- [x] Ensure the same operation has a usable non-HTMX response/redirect.
- [x] Test valid submission, validation errors, duplicate URLs, metadata failure, and non-HTMX submission.

### 10. Custom icon upload

- [x] Use R2 for custom icon objects rather than storing image blobs in D1.
- [x] Configure an R2 binding separately from production bucket identifiers.
- [x] Accept only supported raster image types and enforce a conservative size limit.
- [x] Generate collision-resistant object keys and store only the key in D1.
- [x] Serve uploaded icons through a controlled application route or suitable bound-bucket response.
- [x] Show automatic, uploaded, and fallback choices with an icon preview.
  - [x] Render all three choices and automatic/fallback preview states.
  - [x] Verify the selected custom-file preview through the local browser checkpoint.
  - [x] Clear a stale upload-validation message when a corrected file is selected.
  - [x] Keep long uploaded filenames inside the preview card and use action-appropriate add/edit copy.
- [x] Add a Refresh automatic icon action.
- [x] Preserve the previous icon when an edit or replacement upload fails.
- [x] Remove unreferenced uploaded objects after successful replacement or favorite deletion.
  - [x] Remove the previous object after a successful replacement or icon-mode change.
  - [x] Remove the associated object after favorite deletion.
- [x] Test invalid types, oversized uploads, missing R2 objects, replacement, and cleanup behavior.
  - [x] Cover invalid types, spoofed contents, oversized uploads, missing objects, and failed-create cleanup.
  - [x] Cover replacement cleanup with the edit workflow.
  - [x] Cover deletion cleanup with the delete workflow.

### 11. Edit favorite

- [x] Implement `GET /admin/favorites/:id/edit`.
- [x] Implement the authenticated update endpoint.
- [x] Allow changes to display name, URL, icon source, and enabled state.
- [x] When the URL changes, offer Keep existing icon or Find icon from new site.
  - [x] Keep the current automatic icon by default and require an explicit refresh choice.
- [x] Show a current/new icon preview before saving when applicable.
  - [x] Show the web-address preview only for Automatic mode and keep custom-upload previews inside the Custom upload option.
- [x] Return field-level errors without discarding valid input.
- [x] Replace the admin row with HTMX after a successful update and support a normal redirect fallback.
- [x] Bring the admin workspace into view when Edit or Add Favorite is selected from lower on the dashboard.
- [x] Test missing favorite, URL change choices, enable/disable, icon-mode changes, and invalid updates.
  - [x] Verify a failed replacement leaves the prior D1 reference and R2 object intact.

### 12. Delete favorite

- [x] Implement a small confirmation dialog naming the favorite.
  - [x] Use a server-rendered confirmation page/fragment so deletion remains usable without JavaScript.
- [x] Implement authenticated `DELETE /admin/favorites/:id`.
- [x] Remove the row through HTMX after successful deletion.
  - [x] Accept HTMX's query-string serialization of `DELETE` form values.
- [x] Provide an accessible non-JavaScript deletion path using a confirmed POST action if needed.
- [x] Delete associated uploaded icon objects only after the database mutation succeeds.
- [x] Handle missing records and deletion failures without leaving a misleading UI state.

### 13. Drag-and-drop ordering

- [x] Initialize SortableJS only on the admin favorites list.
  - [x] Load the self-hosted SortableJS bundle only on the admin dashboard and bind it to the favorites list.
  - [x] Verify pointer dragging in the local browser; confirmed through the user testing checkpoint.
- [x] Send the complete ordered favorite ID list to `POST /admin/favorites/reorder`.
- [x] Validate authentication, JSON shape, duplicate IDs, missing IDs, and unknown IDs.
- [x] Update all positions transactionally with increments of 10.
- [x] Keep the server authoritative and restore/reload the stored order after a failed request.
- [x] Provide clear save/failure feedback and a keyboard-accessible ordering alternative if practical within v1.0.
- [x] Verify the public portal immediately reflects the persisted order.

Expected initial routes; exact naming may change if recorded in the decision log:

```text
GET    /
GET    /admin
GET    /admin/login
POST   /admin/login
POST   /admin/logout
GET    /admin/favorites/new
POST   /admin/favorites
GET    /admin/favorites/:id/edit
POST   /admin/favorites/:id
DELETE /admin/favorites/:id
POST   /admin/favorites/reorder
GET    /admin/favorites/icon-preview
```

### 14. End-to-end quality pass

- [x] Seed or create at least 12 representative favorites for local testing.
- [x] Verify portal behavior with JavaScript disabled.
  - [x] Keep the public portal response free of scripts and verify search/favorite navigation uses ordinary HTML.
- [x] Verify add, edit, delete, icon preview/upload, enable/disable, logout, and reorder flows with HTMX enabled.
- [x] Verify all write routes reject unauthenticated requests.
  - [x] Enumerate logout, add, update, reorder, and both delete routes in unauthorized and cross-origin tests.
- [x] Check keyboard navigation, focus order, labels, alternative text, contrast, and touch target sizes.
  - [x] Verify rendered landmark/heading structure, accessible names, image alternatives, keyboard order, and minimum 24px targets on the portal and admin dashboard.
  - [x] Raise small brand, muted, placeholder, and destructive-action text to WCAG AA contrast while retaining the Nord theme.
  - [x] Verify visible focus indicators on portal search, favorite links, and admin controls.
- [x] Check external metadata failure and R2/D1 failure states.
  - [x] Verify unsafe URLs, timeouts, invalid content types, oversized responses, and redirect failures degrade to generated icon fallbacks.
  - [x] Return a safe, actionable service-unavailable response when D1 fails without exposing internal details.
    - [x] Avoid post-write reads that can turn successful add, edit, or delete mutations into ambiguous failures.
  - [x] Preserve entered values and stored data when an R2 upload fails.
  - [x] Report successful edits and deletions truthfully when obsolete R2 object cleanup fails.
  - [x] Ensure a failed D1 create cleans up any newly uploaded R2 object without masking the original failure.
- [x] Run typechecking, automated tests, and production build successfully.
- [x] Perform visual checks at the priority widths and polish the Nord Light portal.
  - [x] Use four favorite columns across typical half-screen and tablet widths while retaining eight wide, three narrow, and two basic-mobile columns.
  - [x] Hide Automatic-only edit choices when Generated fallback or Custom upload is selected.
  - [x] Verify the portal, dashboard, add form, and edit form have no horizontal overflow at the priority widths.
- [x] Confirm no v1.1+ feature or unnecessary abstraction slipped into v1.0.

### 15. Cloudflare deployment

- [x] Create the production Worker configuration.
- [x] Create and bind the production D1 database.
- [x] Create and bind the production R2 bucket used for custom icons.
- [x] Apply production D1 migrations.
- [x] Configure the admin password and session-signing value as Cloudflare secrets.
- [x] Deploy the Worker over HTTPS.
- [x] Skip a custom domain for v1.0; the production `workers.dev` URL is sufficient.
- [x] Keep logging minimal and ensure logs never contain credentials or session cookies.
- [x] Perform a production smoke test of portal, authentication, CRUD, upload, and reorder behavior.
  - [x] Add a repeatable production smoke script that removes its temporary favorite and uploaded icon.
- [x] Record deployment instructions without committing account IDs or secrets.

## v1.0 definition of done

- [x] Portal is deployed publicly.
- [x] Admin area requires authentication.
- [x] Google search works.
- [x] Portal comfortably displays at least 12 favorites.
- [x] Favorites have large high-resolution icons.
- [x] Custom icons can replace bad automatic icons.
- [x] Admin can add a favorite.
- [x] Admin can edit a favorite.
- [x] Admin can delete a favorite.
- [x] Admin can drag favorites into a new order.
- [x] Portal reflects that order.
- [x] Layout reflows cleanly in a split-screen browser window.
- [x] Nord Light theme is polished enough for daily use.
- [ ] A first-time user can use the portal without needing an explanation.

After deployment, stop feature development long enough to determine whether WebVista sees real everyday use. That usage determines whether v1.1 is worth building.

## v1.0 non-goals

- Weather
- For You links
- Bookmarklet
- Watch section or TMDb metadata
- Plex API integration
- Backgrounds
- Notes and reminders
- Dark mode
- Multiple administrators, user accounts, roles, or OAuth
- Analytics
- Full mobile admin optimization
- Customizable grid column count

## Later roadmap

Later milestones remain intentionally high-level until v1.0 usage is validated.

### v1.1 — Weather

- [ ] Confirm usage justifies continuing development.
- [ ] Show current temperature and conditions.
- [ ] Show daily high and low.
- [ ] Make the location configurable through admin.
- [ ] Retrieve weather server-side.
- [ ] Cache weather data within free-tier constraints.

### v1.2 — For You

- [ ] Add a curated For You section.
- [ ] Allow URLs to be added through admin.
- [ ] Retrieve Open Graph thumbnail, title, description, and source/site name.
- [ ] Support manual metadata overrides.
- [ ] Allow sorting and removal.
- [ ] Provide a browser bookmarklet that opens an authenticated admin preview before saving.

### v1.3 — Mobile Admin

- [ ] Create a mobile-specific admin layout.
- [ ] Use large touch targets and mobile-friendly forms.
- [ ] Make item sorting touch-friendly.
- [ ] Optimize the bookmarklet → preview → add workflow.

The public portal should already resize reasonably before this release.

### v1.4 — Watch

- [ ] Add a poster-based Watch section.
- [ ] Support Plex, Netflix, Prime Video, and other direct streaming links.
- [ ] Accept a direct watch URL and an IMDb or TMDb ID.
- [ ] Retrieve poster, title, year, and movie/TV type through TMDb.
- [ ] Show a service badge and preview before saving.
- [ ] Allow sorting and removal.

No Plex API integration is required initially.

### v1.5 — Backgrounds

- [ ] Upload high-resolution backgrounds to R2.
- [ ] Enable or disable individual backgrounds.
- [ ] Select a random enabled background on portal load.
- [ ] Show admin previews and support deletion.
- [ ] Add a readability overlay and background intensity setting.

Possible later options: daily rotation and timed rotation.

### v1.6 — Notes / Reminders

- [ ] Show a simple admin-authored message prominently on the portal.
- [ ] Support optional start and expiration times.
- [ ] Support normal and important priority.
- [ ] Support an optional **Got it** action.
- [ ] Store acknowledgment status and show it in admin.

Do not turn reminders into a task or calendar application.

## Newly discovered subtasks

Add new implementation work beneath the closest existing checklist item. Use this section only when the correct milestone or parent task is not yet clear.

- None yet.

## Decision log

- **2026-08-14 — Product name:** Use **WebVista** as the display name and `webvista` as the folder/eventual repository slug. The name intentionally evokes a late-1990s web portal.
- **2026-08-14 — Documentation-first bootstrap:** Create planning documentation before initializing Git or scaffolding the application.
- **2026-08-14 — Local repository:** Initialize Git on the `main` branch and make a documentation-first initial commit before publishing or scaffolding the application.
- **2026-08-14 — Plan tracking:** Keep atomic implementation tasks, new subtasks, decisions, deferred ideas, and blockers in this file.
- **2026-08-14 — Custom icons:** Plan to use R2 in v1.0 because uploaded image blobs must not be stored in D1.
- **2026-08-15 — Public repository:** Publish the project at `https://github.com/cmirza/webvista` with `origin` using SSH.
- **2026-08-15 — Worker foundation:** Use Hono on Cloudflare Workers with Wrangler-generated runtime types and Cloudflare's Vitest Workers integration.
- **2026-08-15 — Node runtime:** Pin Node.js 22.12 because the current Vite-based Workers test toolchain requires Node 22.12 or newer.
- **2026-08-16 — Public language:** Keep repository documentation and application copy neutral and free of references to any specific family member or intended individual.
- **2026-08-16 — Frontend assets:** Use Tailwind CSS 4 with daisyUI 5's Nord theme, self-host HTMX and SortableJS from pinned npm packages, and generate `public/assets` during development and deployment rather than committing build output.
- **2026-08-16 — Route boundary:** Keep all admin paths closed behind a temporary redirect/unavailable boundary until real password and signed-session authentication replaces it.
- **2026-08-16 — Testing checkpoints:** After every runnable implementation increment, complete a local smoke test and give the user explicit startup instructions and a focused manual test list before continuing.
- **2026-08-16 — Local D1:** Bind a Wrangler-local `webvista` D1 database, apply pending migrations automatically before local development, and retain a non-production database ID placeholder until the deployment milestone.
- **2026-08-16 — Favorite data boundary:** Normalize favorite URLs before storage, enforce unique stored URLs, assign UUIDs and UTC timestamps in the service, and accept reorders only when they contain the complete stored ID set.
- **2026-08-16 — Portal favorite fallback:** Render favorites as ordinary same-tab links in a width-driven grid, using deterministic initial-based icons until automatic icon discovery provides suitable assets.
- **2026-08-16 — Metadata retrieval boundary:** Fetch metadata with manual redirect validation, a four-second overall timeout, bounded streamed bodies, strict content-type checks, public HTTP/HTTPS targets only, and at most eight verified icon candidates.
- **2026-08-16 — Admin sessions:** Keep the admin password and session-signing key as separate Worker secrets, issue an eight-hour signed `__Host-` cookie with strict browser attributes, and require same-origin admin writes in addition to authentication.
- **2026-08-16 — Dashboard controls:** Render the complete favorites-management dashboard shell, but keep Add, Edit, Remove, and ordering controls disabled until each authenticated workflow is implemented so the interface never leads to dead routes.
- **2026-08-16 — Add favorite flow:** Keep icon previews advisory and re-run bounded discovery on save instead of trusting browser-supplied icon URLs; enhance the normal form with HTMX fragments and out-of-band dashboard updates while preserving full-page validation and redirects without JavaScript.
- **2026-08-16 — Custom icon storage:** Bind R2 without a committed production bucket name, accept only signature-validated PNG/JPEG/WebP files up to 2 MB, store UUID-based object keys in D1, and serve objects through a constrained immutable `/icons/:fileName` route.
- **2026-08-16 — Favorite editing:** Keep an existing automatic icon unless refresh is explicitly selected, validate and store replacement uploads before changing D1, delete a failed replacement object when D1 rejects the update, and remove the previous upload only after a successful update.
- **2026-08-16 — Favorite deletion:** Require an explicit server-validated confirmation, use `DELETE` for the HTMX flow and confirmed `POST` as the no-JavaScript fallback, remove D1 data before its R2 object, and report an R2 cleanup failure without implying that the favorite still exists.
- **2026-08-16 — Favorite ordering:** Send the complete favorite ID order as authenticated same-origin JSON, persist it through the existing transactional D1 batch, reload the authoritative stored order after client failure, and provide Move up/Move down controls as a keyboard-accessible alternative to dragging.
- **2026-08-16 — Accessible Nord contrast:** Keep the Google-style search hint decorative with a separate accessible input label, derive darker brand and critical-text colors from theme variables, render functional muted text at 75% base-content opacity, and keep primary-button hover backgrounds light enough for WCAG AA text contrast.
- **2026-08-16 — Contextual icon previews:** In the edit form, show web-address preview controls only while Automatic mode is selected and render replacement-file previews inside the Custom upload option so each preview stays attached to the choice it affects.
- **2026-08-16 — Storage failure semantics:** Render generic no-store 503 pages without internal error details for unexpected D1 failures, use mutation `RETURNING` results and pre-write counts to avoid ambiguous post-write failures, treat R2 deletion as best-effort cleanup after a successful D1 mutation, and surface persistent warnings when that cleanup fails.
- **2026-08-16 — Responsive grid:** Keep the automatic wide/narrow/mobile grid, but use four explicit equal columns from 768px through 1280px so typical tablet and split-screen windows retain the intended large, obvious favorite targets.
- **2026-08-16 — v1.0 scope freeze:** Keep the public introduction neutral and static so it needs neither personalization nor timezone configuration; ship only search, favorites, icon handling, and their authenticated administration in v1.0, with later roadmap integrations remaining documentation-only until usage is evaluated.
- **2026-08-16 — Production configuration:** Keep account-specific D1 identifiers in an ignored `wrangler.production.jsonc`, commit a placeholder example, and make the production smoke test remove its own D1 and R2 test data so deployment remains repeatable and repository-safe.
- **2026-08-16 — Application links:** Allow administrator-authored registered app schemes such as `weather://` and `shortcuts://`, preserve meaningful non-web fragments, and block executable, local-file, browser-internal, and credential-bearing addresses before storage or rendering.

## Deferred ideas

- Remote custom icon URLs.
- Daily or timed background rotation.
- Custom domain configuration.
- Any feature listed in v1.1–v1.6 until v1.0 usage has been evaluated.

## Blockers

- None.

## Post-deployment usage validation

- [ ] Agree on a short observation period after v1.0 deployment.
- [ ] Set WebVista as the intended user's browser home/start page with their consent.
- [ ] Observe whether they return to it without prompting.
- [ ] Gather lightweight qualitative feedback about search, favorite choices, icon recognition, and layout.
- [ ] Decide whether to stop, refine v1.0, or begin v1.1 based on actual use.
