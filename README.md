# WebVista

WebVista is a lightweight personal web portal designed to work as Dad's browser home page. It favors large, obvious controls, minimal navigation, and genuinely useful information without becoming a traditional dashboard.

The first release has one job: determine whether Dad will actually use it. It will provide Google search and a polished, responsive grid of favorite sites, with administration kept behind a separate authenticated interface.

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

## Project status

Planning is complete; implementation has not started. See [PLAN.md](PLAN.md) for the active checklist, roadmap, decisions, and definition of done.

Contributors and coding agents must read [AGENTS.md](AGENTS.md) before changing the project.
