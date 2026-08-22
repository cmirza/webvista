# WebVista Delivery Plan

WebVista is a lightweight personal portal whose first release answers one question: **Will people actually use this as their browser home/start page?**

This file is the source of truth for scope and progress. Add newly discovered work beneath the relevant checkbox, and check work off only after it has been implemented and verified.

## Status

- Active milestone: **v1.1 — Local date and weather**
- Implementation status: **Favorites, For You, Watch, date, and weather are deployed and production-verified**
- Current phase: **Post-deployment usage observation**
- Next task: **Use the deployed portal normally and record only issues that affect everyday use**

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
  - [x] Normalize stored addresses and allow separately named/iconed favorites to share a destination.
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
  - [x] Keep the masthead concise by using the WebVista wordmark alone without a redundant heading or supporting copy.
- [x] Add prominent Google search above Favorites.
  - [x] Submit with `GET https://www.google.com/search` and a `q` field.
  - [x] Provide a large search input, clear focus state, and visible submit button.
  - [x] Add an accessible multicolor visual prompt that disappears during entry.
  - [x] Verify Enter submits and search works without JavaScript.
  - [x] Clear a previous query when the portal is restored through browser Back navigation.
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
- [x] Keep lower portal rows discoverable on tablet-sized viewports.
  - [x] Render Favorites as one horizontally browsable, scroll-snapped row at portrait tablet widths and wider, short landscape viewports.
  - [x] Provide visible previous/next controls while retaining native touch scrolling.
  - [x] Verify iPad portrait and landscape layouts without changing the desktop grid.

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
- [x] Standardize admin workspace dialogs with one header treatment, one footer action row, and consistent spacing/control sizes.

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
- [x] Test valid submission, validation errors, shared destination URLs, metadata failure, and non-HTMX submission.

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
  - [x] Keep search and favorite navigation as ordinary HTML; limit portal JavaScript to progressive search reset and carousel controls.
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

- [x] Confirm usage justifies continuing development.
- [x] Show the current local date prominently on the portal.
  - [x] Include the full weekday, such as `Monday, August 17`.
  - [x] Keep the full date on one line at full and split-screen desktop widths.
  - [x] Format the date using the browser's local timezone and locale.
  - [x] Keep a useful server-rendered fallback when JavaScript is unavailable.
- [x] Show current temperature and conditions.
- [x] Show daily high and low.
- [x] Use a fixed Portland 97209-area weather location.
  - [x] Never request browser geolocation, avoiding Safari's permission prompt.
  - [x] Keep the location out of D1 because it is a source-controlled constant.
  - [x] Keep provider attribution text out of the compact weather widget.
  - [x] Version cached weather-fragment requests when the rendered fragment format changes.
  - [x] Handle unavailable and timed-out weather requests without blocking the rest of the portal.
- [x] Retrieve weather server-side for the fixed Portland location.
- [x] Use Open-Meteo for keyless current conditions and one-day high/low data.
- [x] Translate provider weather codes into clear, human-readable conditions.
- [x] Cache weather data within free-tier constraints.
- [x] Verify date and weather behavior at wide, split-screen, and narrow widths.
- [x] Keep Watch and For You discoverable on a full-screen 27-inch display using scaled resolution.
  - [x] Add a height-aware compact desktop layout with six Favorites columns and modestly smaller elements without changing narrow layouts.
  - [x] Verify the compact layout at the screenshot's effective 1288×1340 viewport and recheck narrow behavior without horizontal overflow.
  - [x] Distribute unused vertical space between the masthead, Search, Favorites, Watch, and For You instead of leaving it below the content.
- [x] Deploy the date/weather increment and previously verified development features to Workers.dev.
  - [x] Apply pending production D1 migrations before deploying the matching Worker code.
  - [x] Run the cleanup-safe production authentication, CRUD, ordering, and R2 smoke test.
  - [x] Confirm the public production portal renders the date and Portland weather fallback.
  - [ ] Force production HTTP requests onto HTTPS and verify Safari-safe admin login behavior.
    - [x] Redirect every non-local HTTP request to the equivalent HTTPS URL.
    - [x] Send HSTS on production HTTPS responses.
    - [x] Verify the deployed HTTP redirect and secure login-page headers.
    - [ ] Confirm login with the rotated production password in Safari.
- [x] Restrict production traffic to the custom domain.
  - [x] Disable the production `workers.dev` route in Wrangler so a future deploy cannot restore the fallback origin.
  - [x] Update deployment and smoke-test documentation to use the custom domain.

### v1.2 — For You

- [x] Add a curated For You section.
  - [x] Render cards in one horizontal row rather than a wrapping grid.
  - [x] Support touch/trackpad scrolling, scroll snapping, and obvious previous/next controls.
  - [x] Keep the section visually secondary to Favorites.
  - [x] Add a persisted admin switch that hides or shows the entire public For You section without deleting links.
    - [x] Keep the visibility control inside the For You admin card so its scope is unambiguous.
    - [x] Persist changes immediately from the toggle without a redundant save button.
- [x] Allow URLs to be added through admin.
  - [x] Add D1 persistence and an authenticated normal-form workflow.
  - [x] Keep the first increment usable without HTMX.
  - [x] Insert newly added links at the top of the admin queue and portal carousel.
  - [x] Keep the dashboard Add Link and preview workflow fragment-only when enhanced with HTMX.
- [x] Retrieve Open Graph thumbnail, title, description, and source/site name.
  - [x] Reuse the bounded public-URL retrieval boundary used by icon discovery.
  - [x] Stream a bounded HTML prefix so oversized publisher pages can expose head metadata without being fully downloaded.
  - [x] Read standard preview metadata placed after unusually large publisher preload blocks while retaining a conservative response cap.
  - [x] Degrade safely when metadata or an image is missing.
  - [x] Use bounded first-party fallbacks when normal article HTML is blocked or excessively large.
    - [x] Read YouTube previews through YouTube's official oEmbed endpoint.
    - [x] Read NYT previews through its official oEmbed endpoint and exact Bloomberg matches through its first-party technology RSS feed.
    - [x] Retry a conventional first-party AMP page when a publisher blocks the standard article response.
    - [x] Read matching KGW article metadata from KGW's first-party RSS feed when Akamai blocks the article.
    - [x] Detect and verify same-origin AMP pages, automatically use the readable address, and disclose the substitution in preview.
    - [x] Generate an editable title and source from the URL when every server-side retrieval layer is blocked.
- [x] Support manual metadata overrides.
  - [x] Keep the For You Preview Link control at the same standard size as Watch Preview Details in admin and bookmarklet flows.
- [x] Allow saved For You links to be edited.
  - [x] Edit URL, title, source, image, description, and enabled state through an authenticated form.
  - [x] Refresh the dashboard row through HTMX while preserving a normal form fallback.
  - [x] Validate edits without discarding entered values.
- [x] Allow sorting and removal.
  - [x] Add a named server-rendered removal confirmation in the first increment.
  - [x] Add a complete-set server-authoritative reorder operation.
  - [x] Add keyboard-accessible Move controls and persist their changes.
  - [x] Add pointer drag ordering through SortableJS.
  - [x] Confirm pointer drag ordering in the user's browser.
  - [x] Remove rows through HTMX while preserving the confirmed normal-form fallback.
- [x] Provide a browser bookmarklet that opens an authenticated admin preview before saving.
  - [x] Add an authenticated installer with desktop drag and mobile copy instructions.
  - [x] Capture only the current URL and standard Open Graph/Twitter preview fields from the open page.
  - [x] Open a server-validated preview that remains editable and does not re-fetch the publisher.
  - [x] Preserve the bookmarklet preview destination through an expired-session login.
  - [x] Confirm the installed bookmarklet against a publisher-blocked article in the user's browser.

### v1.3 — Mobile Admin

- [ ] Create a mobile-specific admin layout.
- [ ] Use large touch targets and mobile-friendly forms.
- [ ] Make item sorting touch-friendly.
- [ ] Optimize the bookmarklet → preview → add workflow.

The public portal should already resize reasonably before this release.

### v1.4 — Watch

- [x] Add a poster-based Watch section.
  - [x] Add D1 persistence for manually curated movie and TV titles.
  - [x] Render enabled titles in one horizontally browsable poster row.
  - [x] Add an authenticated manual Add Title flow with an editable poster URL.
  - [x] Verify the first runnable Watch increment at wide, split-screen, and narrow widths.
  - [x] Place Watch above For You in the public portal hierarchy.
- [x] Support Plex, Netflix, Prime Video, and other direct streaming links.
  - [x] Validate direct web and registered application links without restricting titles to a service homepage.
  - [x] Preserve meaningful hash-routed destinations used by Plex and similar web applications.
- [x] Accept a direct watch URL and an IMDb or TMDb ID.
  - [x] Accept IMDb IDs/URLs and typed or numeric TMDb IDs.
  - [x] Persist the normalized external identifier with the curated title.
- [x] Retrieve poster, title, year, and movie/TV type through TMDb.
  - [x] Authenticate server-side with an optional TMDb API read token.
  - [x] Keep manual entry usable when TMDb is not configured or unavailable.
  - [x] Verify a live IMDb and TMDb preview with the configured local token.
  - [x] Configure `TMDB_API_TOKEN` on the production Worker and verify a deployed IMDb preview.
  - [x] Keep Preview Details updates inside the dashboard workspace without replacing the surrounding admin sections.
- [x] Show the service and an editable preview before saving.
  - [x] Show the service beneath the title instead of overlaying poster artwork.
  - [x] Keep all retrieved fields editable before saving.
  - [x] Use the standard admin button size for Preview Details instead of oversized lookup text.
- [x] Allow sorting and removal.
  - [x] Edit saved metadata, direct link, service, and enabled state.
  - [x] Remove a title through confirmed HTMX and normal-form flows.
  - [x] Reorder titles with pointer and keyboard-accessible controls.
    - [x] Confirm pointer drag, Move-button persistence, and matching public poster order in the local browser.

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
- **2026-08-16 — Admin sessions:** Keep the admin password and session-signing key as separate Worker secrets, issue an eight-hour signed `__Host-` cookie with `HttpOnly`, `Secure`, and `SameSite=Lax` so bookmarklet top-level navigations remain signed in, and require same-origin admin writes in addition to authentication.
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
- **2026-08-16 — Shared destinations:** Allow multiple favorites to use the same normalized address because independently named and iconed tiles may intentionally target the same service; keep favorite IDs, not URLs, as the identity and ordering boundary.
- **2026-08-16 — For You priority:** Begin v1.2 before Weather and Watch because curated news, YouTube, and general links are the next validated need; keep skipped milestones deferred rather than treating them as prerequisites.
- **2026-08-16 — For You carousel:** Render For You as one horizontally browsable, scroll-snapped row with pointer controls and native touch/trackpad scrolling instead of a wrapping card grid.
- **2026-08-16 — For You metadata fallbacks:** Keep direct bounded Open Graph retrieval as the default, use YouTube's official oEmbed response for YouTube links, retry a publisher's first-party AMP page after blocked HTML, and use KGW's bounded first-party RSS feed for exact matching articles; do not add a third-party scraping proxy.
- **2026-08-16 — For You readability and visibility:** Prefer a verified same-origin AMP destination when a publisher exposes one, disclose that substitution before saving, and persist the global For You visibility separately from its links so hiding the public row never deletes curated content.
- **2026-08-16 — Layered link previews:** Read only a capped HTML prefix for oversized pages, prefer official provider metadata endpoints when available, use bounded exact-match first-party feeds for blocked publishers, and retain manual overrides plus the planned bookmarklet as the final fallback instead of depending on a third-party scraping proxy.
- **2026-08-16 — Generated preview fallback:** When every retrieval layer is blocked, derive an editable title and source from the public URL, disclose that the result needs review, and leave unavailable image/description fields blank rather than fabricating metadata.
- **2026-08-16 — For You insertion order:** Migrate existing curated links to newest-first once, then transactionally shift stored positions and insert each new link at the front so the admin queue and public carousel agree.
- **2026-08-16 — Bookmarklet capture:** Generate the bookmarklet for the current WebVista origin, send only the open page URL and standard Open Graph/Twitter preview fields, never send article body or cookies, validate the captured fields on the server without re-fetching the publisher, preserve the destination through login, and require review before saving.
- **2026-08-16 — For You management:** Reuse the Favorites dashboard interaction pattern for editable For You rows, require each reorder request to contain every stored item exactly once, normalize positions in increments of ten, provide keyboard Move controls alongside SortableJS dragging, and keep edit/removal usable as authenticated normal forms without HTMX.
- **2026-08-16 — Watch foundation:** Start v1.4 with a complete manual curation loop—direct link, title, year, movie/TV type, service, and optional public poster—before adding TMDb lookup or management controls, so the poster row can be validated independently.
- **2026-08-17 — Watch poster treatment:** Keep poster art unobstructed; show the streaming service in the card metadata beneath the title rather than as an overlay badge.
- **2026-08-17 — TMDb lookup:** Accept IMDb IDs/URLs plus typed or media-type-qualified TMDb IDs, call TMDb only from the Worker with a bearer read token, and preserve the fully manual form as a graceful fallback.
- **2026-08-17 — Declared TMDb secret:** Add `TMDB_API_TOKEN` to Wrangler's declared secret names because Wrangler excludes undeclared `.dev.vars` keys whenever `secrets.required` is present; an empty or unavailable token still leaves manual entry usable locally.
- **2026-08-17 — Portal content hierarchy:** Place Watch above For You because curated movies and shows are a more durable destination, while the For You feed is secondary and changes more frequently.
- **2026-08-17 — Watch management:** Reuse the authenticated dashboard workspace for HTMX editing and confirmed removal while preserving full-page normal-form fallbacks; keep hidden titles saved in D1 and visibly labeled in admin.
- **2026-08-17 — Admin dialog consistency:** Use the same spacious shell, eyebrow and heading scale, explanatory copy, and single bottom action row across Favorites, For You, and Watch forms; reserve large lookup controls for preview-driven fields.
- **2026-08-17 — Watch hash routes:** Preserve URL fragments for direct Watch destinations because Plex and similar single-page applications encode the actual title route after `#`; retain fragment stripping for ordinary Favorites and curated article links.
- **2026-08-17 — Watch ordering:** Require every stored Watch ID exactly once, normalize positions in increments of ten, and expose the same server-authoritative drag and keyboard Move controls already validated for Favorites and For You.
- **2026-08-17 — Late publisher metadata:** Raise the bounded article HTML prefix from 256 KiB to 512 KiB because some publishers place standard Open Graph metadata after large preload blocks; retain a strict cap and the shared parser instead of adding publisher-specific scraping code.
- **2026-08-17 — Watch preview workspace:** In the enhanced dashboard flow, submit Preview Details through HTMX and replace only the Watch form shell; retain the complete standalone page response for ordinary no-JavaScript form submission.
- **2026-08-17 — Local date and weather:** Put the full weekday/date on the portal using the browser's locale and timezone, keeping it on one line at desktop widths. Use opt-in browser geolocation as the primary weather location, round and validate coordinates before server-side Open-Meteo and OpenStreetMap Nominatim requests, never persist them in D1, cache coarse weather responses for ten minutes and locality labels for one day, keep provider attribution text out of the compact widget, and always fall back to Portland, Oregon when location access is unavailable.
- **2026-08-17 — Production feature deployment:** Apply D1 migrations `0004` through `0008` before deploying the matching For You, settings, and Watch code; verify the resulting Workers.dev release with the cleanup-safe production smoke test and a read-only public portal check.
- **2026-08-18 — Custom domain:** Use `webvista.cc` as the sole public production origin and disable the Workers.dev route in Wrangler so domain-level security controls cannot be bypassed through a fallback hostname; verify HTTPS, authentication, D1 writes, ordering, and R2 storage through the custom hostname.
- **2026-08-18 — Fixed weather location:** Supersede browser-derived weather with a fixed Portland 97209-area forecast so Safari never displays a location-permission prompt.
- **2026-08-18 — Scaled-display layout:** At wide viewports up to 1440 CSS pixels tall, use six Favorites columns and modestly reduce vertical sizing so Favorites, Watch, and For You all remain visible; retain the existing four-column, large-target treatment for narrower layouts.
- **2026-08-21 — Tablet Favorites carousel:** At portrait tablet widths and at wider landscape viewports no taller than 1024px, render Favorites as one horizontally scrollable row with native touch scrolling and visible browse controls so Watch and For You remain discoverable in both orientations. Keep portrait targets larger, use a compact landscape treatment, and preserve the desktop grid on taller displays.
- **2026-08-21 — Portal masthead:** Use the WebVista wordmark as the page heading and remove “Start here.” because it adds no navigational meaning and consumes valuable vertical space on tablet displays.
- **2026-08-21 — Tablet card treatment:** Let For You artwork fill each tablet card with centered cover cropping and place its source/title over a readability gradient; enlarge Watch posters only in portrait, retaining compact landscape sizing.

## Deferred ideas

- Remote custom icon URLs.
- Daily or timed background rotation.
- Other later roadmap work until the verified For You and Watch build is deployed.

## Blockers

- The cleanup-safe production smoke test cannot authenticate after the password rotation because ignored local `.dev.vars` still contains the previous password. Update it locally before the next full production smoke run; never commit the file.

## Post-deployment usage validation

- [ ] Agree on a short observation period after v1.0 deployment.
- [ ] Set WebVista as the intended user's browser home/start page with their consent.
- [ ] Observe whether they return to it without prompting.
- [ ] Gather lightweight qualitative feedback about search, favorite choices, icon recognition, and layout.
- [ ] Decide whether to stop, refine v1.0, or begin v1.1 based on actual use.
