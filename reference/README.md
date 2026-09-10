# Reference artifacts

Not served. Nothing in this directory is copied into the build output.

## `webflow-index.html`

The original Webflow export of the landing page, kept only as a visual reference for the
React port in `src/routes/index.tsx`.

It used to live at `public/index.html`. It was moved here because Cloudflare Workers (and
every other static-asset-first host) serves `public/index.html` at `/` **before** invoking
the SSR worker, so this file silently shadowed the app's root route in production, and the
live site served the stale Webflow page instead of the React app. Vite's dev server
prioritises the route over `publicDir`, so the problem was invisible locally.

**Do not move this file back into `public/`.**

To view it, open it directly from disk, or copy it into `public/` temporarily under a name
other than `index.html`. Note that its asset paths assume `<base href="/">`, so it renders
correctly only when served from a server rooted at the project's `public/` directory.
