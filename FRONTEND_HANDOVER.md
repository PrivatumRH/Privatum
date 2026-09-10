# PRIVATUM Frontend Handover — Webflow → TanStack Start Migration

**Last updated**: September 9, 2026
**Status**: ✅ **Resolved.** The landing page renders at full visual parity with the original Webflow export.
**Fix commit**: `dd72a77`

---

## 1. Executive Summary

The **PRIVATUM** website (private payments, non-custodial, on Robinhood Chain) has been migrated from a
static Webflow export to a native **TanStack Start (React 19 + TanStack Router + Vite + Nitro + Tailwind
CSS v4)** application.

The landing page route (`/`) previously rendered completely unstyled — white background, navbar links
stacked vertically, and the hero gradient displaying inline at its natural 2172px width instead of as a
positioned background cover.

**The cause was a single malformed CSS selector in the Webflow export.** It was not a Tailwind conflict,
not a MIME-type problem, and not a specificity problem. All three of those were previously suspected and
have now been ruled out with evidence (see §3).

Crucially, the same defect also broke `public/index.html` — the file this document previously called the
"source of truth for original visual design." It was rendering just as badly as the React port. Any
comparison against it was therefore comparing two broken pages, which is why the migration seemed
"weirdly hard": the reference itself was broken.

---

## 2. Actual Root Cause

### Malformed `:not()` selector truncated 82% of the Webflow stylesheet

`webflow.css` contained three selectors with an unclosed `:not(` parenthesis:

```css
/* line 1106, 1128, 1141 — BROKEN */
.w-widget-twitter-count-shim:not(.w--vertical.w--large        { ... }
.w-widget-twitter-count-shim:not(.w--vertical.w--large:before { ... }
.w-widget-twitter-count-shim:not(.w--vertical.w--large:after  { ... }
```

The `(` is never closed. Per the CSS Syntax spec, `(` opens a simple block that the parser consumes until
it finds a matching `)`. Everything after line 1106 — roughly 200 KB, including every layout, colour,
flex, and positioning rule the design depends on — got swallowed into that unterminated block and
discarded.

**Measured impact:** the browser parsed only **158 of ~919 rules** from a 216 KB stylesheet. Every rule
defining the actual PRIVATUM design lives after line 1106, so effectively none of the design applied. What
survived was Webflow's generic normalize/base block, which is exactly why the page looked like raw
unstyled HTML.

The three affected selectors govern a Twitter share-button widget that this site does not use — so the
fix carries no visual risk.

**The fix** (restore the closing parenthesis):

```css
.w-widget-twitter-count-shim:not(.w--vertical).w--large        { ... }
.w-widget-twitter-count-shim:not(.w--vertical).w--large:before { ... }
.w-widget-twitter-count-shim:not(.w--vertical).w--large:after  { ... }
```

Applied to all three copies of the file (see §4). Parsed rules went **158 → 919**, and the design
immediately rendered correctly.

> [!TIP]
> **Regression guard.** Any future Webflow re-export can reintroduce this. Before trusting a new export,
> check that parentheses balance:
>
> ```bash
> python -c "
> import re,sys
> s=open('public/webflow.css',encoding='utf-8').read()
> s=re.sub(r'/\*.*?\*/','',s,flags=re.S)
> s=re.sub(r'\"[^\"\n]*\"','\"\"',s); s=re.sub(r\"'[^'\n]*'\",\"''\",s)
> print('braces %d/%d  parens %d/%d'%(s.count('{'),s.count('}'),s.count('('),s.count(')')))"
> ```
>
> Braces and parens must match exactly. A mismatch means the stylesheet is silently truncated.
> An even faster in-browser check: `document.styleSheets[n].cssRules.length` should be in the
> **900+** range for `webflow.css`, never ~158.

---

## 3. Previously Suspected Causes — Now Ruled Out

The earlier revision of this document listed four root causes. Recording the outcome of each so nobody
re-investigates them:

| # | Previous claim | Verdict | Evidence |
| :-- | :--- | :--- | :--- |
| **A** | Vite serves `styles.css?url` as `text/javascript`, so browsers reject the stylesheet | ❌ **Not a bug** | Vite content-negotiates on the `Sec-Fetch-Dest: style` request header. Real browsers (Chrome and Firefox both send it) receive `Content-Type: text/css`. The `text/javascript` response only appears when fetching with a tool that omits that header, such as `curl`. Verified: `curl -H "Sec-Fetch-Dest: style" .../src/styles.css` → `text/css`. |
| **B** | Tailwind v4 Preflight overrides Webflow's base styles | ❌ **Not a bug** | The Webflow imports are **unlayered**, and unlayered CSS beats everything in a cascade layer regardless of source order. Tailwind puts Preflight in `@layer base`, so it loses to Webflow by construction. No `!important` overrides are needed and none were added. |
| **C** | Stylesheets linked twice in the root shell | ✅ **Real** — fixed | They were actually linked *three* times (bundled via `styles.css`, plus `Route.head({links})`, plus manual tags in `RootShell`). ~260 KB of CSS downloaded twice over. Deduplicated; see §4. |
| **D** | Hero `.bg-image` needs explicit absolute positioning | ❌ **Symptom, not cause** | `.bg-image { position: absolute; inset: 0% }` already existed in `webflow.css` at line 3393 — inside the truncated region. Once truncation was fixed, it applied on its own. |

The `!important` override block that the old §5 "Strategy B" recommended was **not** applied and should
not be. It would have masked the truncation rather than fixing it, and would have left the other ~900
discarded rules still missing.

---

## 4. What Changed (`dd72a77`)

| File | Change |
| :--- | :--- |
| `src/styles/webflow.css` | Fixed 3 malformed `:not()` selectors (the bundled copy — this is the one the app actually ships) |
| `public/webflow.css` | Same fix (standalone copy) |
| `public/6a5d…/css/callium.webflow.shared.cd6b91f9a.css` | Same fix — this is the copy `index.html`, `docs.html` and `case-study.html` load |
| `src/routes/__root.tsx` | Removed duplicate `<link>` tags from both `Route.head({links})` and `RootShell`. `styles.css` is now the single stylesheet entry point |
| `src/styles.css` | Reordered imports to mirror the original export (`webflow` → `fonts` → `privatum`, privatum last so brand overrides win) and documented why the order and the unlayered-import behaviour are load-bearing |

### Current styling architecture

```
src/styles.css                    ← single entry point, linked once via ?url
├── @import "tailwindcss"         ← layered (base/components/utilities)
├── @import "tw-animate-css"
├── @import "./styles/webflow.css"    ┐
├── @import "./styles/fonts.css"      ├─ unlayered → always beats Tailwind
└── @import "./styles/privatum.css"   ┘  (privatum last = brand overrides win)
```

Production output is a single `assets/styles-*.css` bundle, **288 KB / 45 KB gzipped**.

> [!IMPORTANT]
> Do **not** re-add `<link>` tags for `/webflow.css`, `/fonts/fonts.css`, or `/privatum.css` in
> `__root.tsx`. Those files exist in `public/` only for the standalone static pages
> (`docs.html`, `case-study.html`, `dashboard.html`). Linking them from the React shell double-loads
> ~260 KB and makes cascade order unpredictable.

---

## 5. Verification

Measured with both pages fully loaded at a 1600px viewport:

| Metric | Webflow original (now `reference/webflow-index.html`) | `/` (React port) |
| :--- | :--- | :--- |
| `webflow.css` rules parsed | 919 | 919 |
| `document.documentElement.scrollHeight` | 13647 | 13647 |
| Section heights (all 15, in order) | 790, 842, 770, 983, 955, 1078, 1142, 831, 685, 991, 1697, 450, 1015, 847, 554 | *identical* |
| `.nav-menu` computed `display` | `flex` | `flex` |
| `.bg-image` computed `position` | `absolute` | `absolute` |
| Elements with `visibility: hidden` / `opacity: 0` | 0 | 0 |

**Layout is byte-identical between the original export and the React port.**

Also confirmed working in the port: the Product mega-menu (three columns, promo card, social icons,
chevron state), hero gradient and CTAs, feature cards, and the network chip. The mega-menu, mobile menu,
tabs, sliders, and FAQ accordions are React state rather than Webflow's `webflow.js` IX2 runtime, which
is intentionally not loaded.

`bun run build` exits 0. The built CSS bundle was checked for balance (2846/2846 braces, 2772/2772
parens) to confirm the minifier does not reintroduce truncation.

> [!NOTE]
> `bun run lint` and `tsc --noEmit` were **not** run against this change set. The change is 5 files,
> 4 of them CSS, and the build compiles clean — but running both is still worth doing before the next
> deploy.

---

## 6. Environment Gotchas (not app bugs)

Two things will waste your time if you hit them cold:

1. **Editing a file in `public/` while `bun run dev` is running makes that file 404.** Vite's dev watcher
   drops it from the served set on in-place rewrite, and the request falls through to the TanStack
   router, which returns its styled 404 page — so it looks like a routing bug rather than a static-file
   bug. **Restart the dev server** and it serves normally again. This bit us mid-investigation and cost
   real time; it is not a defect in this project.

2. **`npx vite preview` fails** with `Cannot find module dist/server/server.js`. The Nitro build outputs
   to `.output/`, not `dist/`, so the preview plugin looks in the wrong place. This is a pre-existing
   config mismatch, unrelated to the styling work. Use the Nitro output directly
   (`.output/server/index.mjs`) or `npx nitro deploy --prebuilt` instead.

### 6.3 `public/index.html` silently shadowed the app's root route in production ⚠️

> [!CAUTION]
> **Never put a file named `index.html` in `public/`.** It will not break anything locally, and it
> will break the deployed site completely.

Everything in `public/` is copied to `.output/public/`, which Cloudflare Workers mounts as the
static-asset directory (`assets.directory` in `.output/server/wrangler.json`). Assets are matched
**before** the SSR worker runs, and `html_handling` maps `/` to `/index.html`. So a request for `/`
was answered with the stale Webflow export and the React route never executed.

Vite's dev server resolves routes before `publicDir`, so `bun run dev` served the React app at `/`
the whole time. Dev and production disagreed, which is what made this hard to see: the code was
correct and deploying cleanly, while the live URL served a completely different, months-old page —
old CTAs, old Open Graph tags, none of the styling fixes.

Reproduce the old failure from any build:

```bash
cd .output/public && python -m http.server 4999
curl -s http://localhost:4999/ | grep -c "Open Dashboard"   # was 5, must now be 0
```

**Fixed by** moving the file to `reference/webflow-index.html` (outside `public/`, so it is never
copied into the build) and rewriting the 9 `href="index.html"` back-links in `case-study.html`,
`dashboard.html` and `docs.html` to `href="/"`.

The same trap applies to any future route: a file at `public/<name>.html` will shadow a React route
at `/<name>`. The static pages that remain — `docs.html`, `case-study.html`, `dashboard.html` — are
served deliberately and have no competing React route, so they are fine.

---

## 7. Project Constraints

> [!IMPORTANT]
> - **DO NOT add `vercel.json`.** Strictly prohibited in this repository.
> - **DO NOT rewrite published git history.** No rebase, squash, or force-push on `master` (connected to
>   Lovable; history must stay linear and forward-only).
> - **Do not add `!important` overrides to fight the Webflow cascade.** The unlayered-import setup in
>   `src/styles.css` already gives Webflow priority over Tailwind. If a Webflow rule is not applying,
>   suspect stylesheet truncation (§2) before reaching for `!important`.

---

## 8. Current State of the Codebase

| Path | Description | Status |
| :--- | :--- | :--- |
| `src/routes/index.tsx` | React port of the Webflow landing page (2416 lines) | ✅ Complete, at visual parity |
| `src/routes/__root.tsx` | App shell, router context, head tags | ✅ Single stylesheet link |
| `src/styles.css` | Tailwind v4 theme + Webflow imports | ✅ Documented import order |
| `src/styles/webflow.css` | Webflow layout stylesheet (~217 KB) | ✅ Selector fixed |
| `src/styles/privatum.css` | PRIVATUM brand overrides (~41 KB) | ✅ Unchanged |
| `reference/webflow-index.html` | Original Webflow export | Reference only — **moved out of `public/`**, see §6.3 |
| `public/dashboard.html` | Web3 dashboard | Static page, intact |
| `public/case-study.html` | Case studies | Static page, intact |
| `public/docs.html` | Documentation | Static page, intact |

**Note:** `public/webflow.css` is now orphaned — no page references it, since the static pages load
`6a5d…/css/callium.webflow.shared.cd6b91f9a.css` and the React app bundles `src/styles/webflow.css`.
It was kept (and patched) to stay consistent with the other copies, but it can be deleted in a
follow-up cleanup.

---

## 9. Pre-Launch State: Coming-Soon CTAs & Social Metadata

The landing page ships in full at `/`, but the product behind it is not live. Two changes reflect that.

### 9.1 Every route into the dashboard is inert

`public/dashboard.html` is not linked from the landing page any more. There are **zero**
`href="/dashboard.html"` links in the rendered output.

| Surface | Before | Now |
| :--- | :--- | :--- |
| Hero CTA | "Privatum - Open Dashboard" → dashboard | "Coming soon", inert |
| Navbar (2) | "Connect Wallet", "Open Dashboard" | Both "Coming soon", inert |
| Mega-menu promo card | "Open Dashboard" | "Coming soon", inert |
| Mobile menu CTA | "Open Dashboard" | "Coming soon", inert |
| Reliability section CTA | "Open Dashboard" | "Coming soon", inert |
| Demo form | GET → `/dashboard.html` | No `action`/`method`; submit shows the tooltip |
| Product links ×14 (mega menu, mobile menu, footer, highlight cards) | → dashboard | Labels kept, inert, `data-soon` tooltip |

Two different treatments, deliberately:

- **CTA buttons** render through the `ComingSoonCta` component in
  [`src/routes/index.tsx`](src/routes/index.tsx) — label becomes "Coming soon".
- **Named product links** (Dashboard, Private Send, Stealth Receive, Swaps) keep their labels and
  reuse the `data-soon` tooltip already in `privatum.css`, the same mechanism the X and Telegram
  icons use. Renaming all four to "Coming soon" would have made the mega menu unreadable.

> [!NOTE]
> `ComingSoonCta` renders an `<a>` with **no `href`** — an HTML "placeholder link". It must stay an
> anchor rather than a `<span>`: the Webflow design colours these buttons through the bare
> `a { color: … }` rule at `webflow.css:2368`, so a `<span>` inherits the section's text colour and
> the label vanishes against the button fill. This was caught in review; don't "simplify" it back.

Links to pages that genuinely exist — `docs.html`, `case-study.html`, the case-study subpages —
are untouched and still navigate.

### 9.2 Open Graph

The previous `og:image` pointed at the Webflow template's stock asset, so every shared link
rendered a card reading **"Callium – AI Call Agent Website"** — an unrelated product.

- Replaced with `public/assets/og-image.jpg` (1200×630, 117 KB), generated from the brand gradient,
  the white mark, and Inter Tight by [`scripts/make_og.py`](scripts/make_og.py). Re-run it after any
  brand change; it is JPEG because the grainy gradient makes PNG ~735 KB.
- Added `og:site_name`, `og:url`, `og:image:width`/`height`/`alt`, and `twitter:image:alt`.
- Titles and descriptions no longer carry the template's boilerplate copy.

### 9.3 The standalone static pages had their own stale metadata

`__root.tsx` only controls the React app. The seven standalone pages under `public/` each carry
their own `<head>`, and none of them had been touched since the Webflow export:

| Page | Was | Now |
| :--- | :--- | :--- |
| `case-study.html` | Callium share card; description "Showcase successful client projects…" | PRIVATUM card, real description |
| `case-study/*.html` ×4 | og:image **404** (see below); template descriptions; og:titles from the *template's* case studies ("41% Faster Resolution", "84% Fewer Missed Calls") that did not match the actual page content | PRIVATUM card, descriptions taken from each page's own opening sentence, og:titles matching each `<h1>` |
| `docs.html` | No og:image at all | PRIVATUM card added |
| `dashboard.html` | No Open Graph tags at all | Full set added |

All seven now also carry `og:site_name`, `og:type` and `twitter:card`.

> [!NOTE]
> The four case-study subpages referenced
> `…/6a5d555086cf13ef3e6b73e9_Privatum-Social%20Share.webp`, but the file on disk is
> `…_Callium-Social Share.webp`. Someone had find-replaced "Callium" → "Privatum" across the HTML
> without renaming the asset, so that og:image had been returning **404** ever since. Both stock
> share images were byte-identical anyway (same MD5) — the Callium template card.

> [!IMPORTANT]
> **`og:image` is still root-relative (`/assets/og-image.jpg`) everywhere, and crawlers ignore
> relative paths.** Two separate things need the production domain before share cards show an image:
>
> 1. **The React app** — set `VITE_SITE_URL` (e.g. `https://privatum.io`, no trailing slash) in the
>    deploy environment. [`src/lib/site.ts`](src/lib/site.ts) turns it into absolute URLs. Note this
>    is inlined at **build** time by Vite, so it must be set for the build, not as a runtime variable.
> 2. **The seven static pages** — these have no env-var mechanism, so the origin has to be written
>    into the HTML. Left root-relative until the domain is decided.
>
> Verify after deploying with the X Card Validator or `https://www.opengraph.xyz/`. Note that X,
> Slack and Discord cache OG data aggressively — use the validator to force a re-scrape rather than
> judging by an old link preview.

---

## 10. Remaining Work

- [ ] Port the remaining static pages (`docs.html`, `case-study.html`, `dashboard.html`) to TanStack
      routes, following the same pattern as `index.tsx`.
- [ ] Once ported, collapse the three duplicate copies of `webflow.css` down to the single bundled
      `src/styles/webflow.css`.
- [ ] Add the paren-balance check from §2 to CI so a future Webflow re-export cannot silently
      reintroduce the truncation.
- [ ] Consider optimising `assets/privatum-gradient-clean.png` (1.9 MB, 2172×724) — it is the largest
      asset on the landing page and noticeably slows first paint.
- [ ] Fix the `vite preview` / Nitro output-path mismatch (§6.2).
- [ ] Add a CI guard that fails the build if `public/index.html` reappears (§6.3) — this one cost a
      full debugging cycle and is trivial to reintroduce from a Webflow re-export.
- [ ] Set `VITE_SITE_URL` in the deploy environment so share cards carry an image (§9.2).
- [ ] Point the X and Telegram links at real accounts — still `href="#"` placeholders.
- [ ] When the dashboard ships, restore the CTAs listed in §9.1 to real links.

---

## 11. How to Run & Verify

```bash
bun install          # install dependencies
bun run dev          # local dev server on port 8080
bun run build        # production build (Nitro → .output/)
bun run lint         # eslint
```

To compare against the original Webflow export, copy `reference/webflow-index.html` into `public/`
under a name other than `index.html` (e.g. `public/_ref.html`) and open it alongside
`http://localhost:8080/`. Delete the copy afterwards — anything named `index.html` in `public/`
shadows the app's root route in production (§6.3).
