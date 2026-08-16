# WebVista Agent Guide

These instructions apply to the entire repository.

## Before making changes

1. Read `README.md` and `PLAN.md`.
2. Identify the active milestone and the smallest unchecked task that matches the request.
3. Inspect the current implementation before proposing or applying changes.
4. Keep the requested work inside the active milestone unless the user explicitly changes scope.

## Plan maintenance

- Treat `PLAN.md` as the source of truth for scope, progress, and decisions.
- Add newly discovered work as a nested checkbox under the relevant task before or while addressing it.
- Put unrelated ideas in **Deferred ideas**, not in the active implementation checklist.
- Mark a task complete only after its implementation and relevant verification are complete.
- Do not mark parent tasks complete while any required child task remains open.
- Record material product or technical decisions in **Decision log** with the date and rationale.
- Record a blocking issue in **Blockers** and remove or resolve the entry when it is no longer blocking.
- Keep the definition-of-done checklist outcome-focused; implementation tasks belong in the milestone checklist.

## Engineering direction

- Prefer server-rendered Hono views and normal HTML forms, enhanced with HTMX only where it improves the interaction.
- Ensure core portal behavior, especially search and favorite links, works without JavaScript.
- Use browser/window width for responsive behavior; do not infer layout from device type.
- Keep the public portal free of admin controls, admin links, and unnecessary navigation.
- Keep all admin routes and write endpoints authenticated.
- Keep the server authoritative for persisted ordering and state.
- Favor direct, readable modules over repository/service/domain layering unless current complexity justifies it.
- Do not build infrastructure solely for a future milestone.
- Maintain compatibility with Cloudflare Workers and the Cloudflare free tier.
- Use theme variables rather than hard-coded component colors so future themes remain possible.

## Security and repository hygiene

- Never commit passwords, secrets, session keys, API keys, `.dev.vars`, or production identifiers.
- Do not commit dependencies, build output, coverage output, local D1 data, Wrangler state, or uploaded test assets.
- Validate and normalize user-controlled URLs and identifiers on the server.
- Treat fetched remote metadata and images as untrusted input.
- Preserve user-authored changes and keep unrelated edits out of the current task.
- Do not initialize Git, create a remote, or publish the project unless the user explicitly requests it.

## Verification

- Add or update tests with behavior changes.
- Test server-rendered responses and authenticated write boundaries.
- Exercise HTMX fragments both as partial requests and through their containing pages.
- Check the portal at wide, half-screen, and narrow widths when UI behavior changes.
- Run the applicable typecheck, tests, and build before marking work complete.
- If a verification step cannot run, leave the task open and document the reason in `PLAN.md`.
- Treat every runnable implementation increment as a user testing checkpoint: smoke-test it locally, then tell the user exactly how to start it and what changed before beginning the next increment.
