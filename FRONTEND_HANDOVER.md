# PRIVATUM Frontend Handover & Issue Breakdown

**Date**: September 9, 2026  
**Target Audience**: Frontend Developer  
**Status**: Landing page styling regression during migration to TanStack Start / React 19  

---

## 1. Executive Summary

We are migrating the **PRIVATUM** website (Private payments, non-custodial on Robinhood Chain) from a static Webflow export to a native **TanStack Start (React 19 + TanStack Router + Vite + Nitro + Tailwind CSS v4)** application.

While the app builds successfully (`bun run build` exits 0), the landing page route (`/`) currently renders with broken styling (white background instead of dark theme, navbar links stacked vertically, and the gradient background image displaying inline at its natural dimensions instead of positioned as a background cover).

The core Webflow design and HTML structure are completely preserved in `public/index.html` and ported into `src/routes/index.tsx`. This handover details the exact technical root causes and the recommended solution paths for the frontend team.

---

## 2. Identified Technical Root Causes

### A. MIME Type Mismatch in Vite Dev Server (`styles.css?url`)
- **Location**: [`src/routes/__root.tsx`](file:///home/skipp/Documents/projects/marmo/privatum/src/routes/__root.tsx)
- **Problem**: The root route imports `styles.css` as a URL query:
  ```tsx
  import appCss from "../styles.css?url";
  ```
  In Vite dev mode (`bun run dev`), Vite resolves this to `/src/styles.css`. When the browser fetches this stylesheet link, Vite serves it with `Content-Type: text/javascript` (an HMR wrapper script containing `__vite__updateStyle`).
- **Consequence**: Browsers (especially Firefox and Chrome with strict MIME checks) reject `<link rel="stylesheet" href="/src/styles.css">` with console warnings:
  ```text
  Layout was forced before the page was fully loaded. If stylesheets are not yet loaded this may cause a flash of unstyled content.
  ```

### B. Tailwind CSS v4 Preflight Clashing with Webflow Styles
- **Location**: [`src/styles.css`](file:///home/skipp/Documents/projects/marmo/privatum/src/styles.css)
- **Problem**: Tailwind v4 includes Preflight base resets by default:
  ```css
  :root {
    --background: oklch(1 0 0); /* Pure White */
    --foreground: oklch(0.129 0.042 264.695);
  }
  body {
    background-color: var(--color-background); /* Sets canvas to white */
  }
  ```
- **Consequence**: Webflow relies on global CSS custom properties (such as `--_sizes---default-size--width: 100%`, `--_colors---...`) and specific cascade inheritance. The base reset overrides body background and resets `img` styles (`display: block; max-width: 100%`), preventing `.bg-image` from functioning correctly unless explicitly prioritized.

### C. Head & Stylesheet Duplication in Root Shell
- **Location**: [`src/routes/__root.tsx`](file:///home/skipp/Documents/projects/marmo/privatum/src/routes/__root.tsx)
- **Problem**: Stylesheets are linked twice:
  1. Once inside TanStack Router's `Route.head({ links: [...] })` rendered via `<HeadContent />`.
  2. A second time manually inside `<RootShell>` `<head>`:
     ```tsx
     <HeadContent />
     <link rel="stylesheet" href="/webflow.css" />
     <link rel="stylesheet" href="/fonts/fonts.css" />
     <link rel="stylesheet" href="/privatum.css" />
     ```
- **Consequence**: Hydration mismatches and unpredictably ordered style evaluations.

### D. Hero Background & Flex Container Specificity
- **Location**: [`src/styles/privatum.css`](file:///home/skipp/Documents/projects/marmo/privatum/src/styles/privatum.css) and [`src/routes/index.tsx`](file:///home/skipp/Documents/projects/marmo/privatum/src/routes/index.tsx)
- **Problem**: The hero background image `<img class="bg-image" src="/assets/privatum-gradient-clean.png" />` requires absolute positioning (`position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none;`) inside a parent with `position: relative; overflow: hidden;`. When Webflow CSS fails to apply or gets overridden, the 2159px image renders as a static block, pushing the layout down.

---

## 3. Current State of the Codebase

| Path | Description | Status |
| :--- | :--- | :--- |
| [`src/routes/index.tsx`](file:///home/skipp/Documents/projects/marmo/privatum/src/routes/index.tsx) | Complete React port of Webflow landing page | Functionally complete (interactive mega-menu, mobile menu, tabs, sliders, FAQ accordions) |
| [`src/routes/__root.tsx`](file:///home/skipp/Documents/projects/marmo/privatum/src/routes/__root.tsx) | App shell, router context, head tags | Needs CSS link cleanup |
| [`src/styles.css`](file:///home/skipp/Documents/projects/marmo/privatum/src/styles.css) | Global Tailwind v4 configuration | Contains `@import` of Webflow & Privatum CSS; base theme overrides body |
| [`public/webflow.css`](file:///home/skipp/Documents/projects/marmo/privatum/public/webflow.css) | Webflow layout stylesheet (~207 KB) | Working standalone, but clashes when mixed with Tailwind |
| [`public/privatum.css`](file:///home/skipp/Documents/projects/marmo/privatum/public/privatum.css) | Custom PRIVATUM theme styles (~41 KB) | Active brand rules (fonts, logo pseudo-elements) |
| [`public/index.html`](file:///home/skipp/Documents/projects/marmo/privatum/public/index.html) | Original working Webflow HTML export | **Source of truth** for original visual design |
| [`public/dashboard.html`](file:///home/skipp/Documents/projects/marmo/privatum/public/dashboard.html) | Functional Web3 dashboard | Intact & working |
| [`public/case-study.html`](file:///home/skipp/Documents/projects/marmo/privatum/public/case-study.html) | Case studies page | Intact & working |
| [`public/docs.html`](file:///home/skipp/Documents/projects/marmo/privatum/public/docs.html) | Documentation page | Intact & working |

---

## 4. Strict Project Constraints

> [!IMPORTANT]
> - **DO NOT add `vercel.json`**: This file is strictly prohibited in this repository.
> - **DO NOT rewrite published git history**: Do not rebase, squash, or force-push commits already pushed to `master` (connected to Lovable; git history must remain linear and forward-only).
> - **Browser testing**: Do not rely on automated headless browsers or chromium agents if testing locally; verify using local dev server (`bun run dev`) and standard browser testing.

---

## 5. Recommended Implementation Paths for Frontend Dev

### Strategy A: Clean Tailwind Styling (Recommended Long-Term)
Rather than fighting 200KB of conflicting Webflow global styles and Tailwind preflights:
1. In [`src/routes/index.tsx`](file:///home/skipp/Documents/projects/marmo/privatum/src/routes/index.tsx), keep the clean component structure already written.
2. Apply Tailwind classes directly to key layout wrappers:
   - Navbar: `sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-[#080a0f]/80 backdrop-blur-md`
   - Hero section: `relative min-h-screen bg-[#080a0f] text-white flex flex-col items-center justify-center overflow-hidden`
   - Background gradient: `absolute inset-0 w-full h-full object-cover pointer-events-none -z-10`
   - Hero text: `text-5xl md:text-7xl font-bold tracking-tight text-center max-w-4xl`
3. Remove `@import "./styles/webflow.css";` from `src/styles.css` to eliminate style conflicts entirely.

### Strategy B: Quick Isolation of Webflow Styles
If retaining the Webflow CSS classes without rewriting styles:
1. **Fix Root Route Imports** in [`src/routes/__root.tsx`](file:///home/skipp/Documents/projects/marmo/privatum/src/routes/__root.tsx):
   - Directly import CSS in client entry or root: `import "../styles.css";` instead of `?url`.
   - Remove duplicate `<link rel="stylesheet">` tags from `<RootShell>` and let TanStack Router manage head links cleanly.
2. **Override Tailwind Resets** in [`src/styles/privatum.css`](file:///home/skipp/Documents/projects/marmo/privatum/src/styles/privatum.css):
   ```css
   html, body {
     background-color: #080a0f !important;
     color: #ffffff !important;
   }
   .section.hero {
     position: relative !important;
     overflow: hidden !important;
     background-color: #080a0f !important;
   }
   .section.hero > .bg-image {
     position: absolute !important;
     inset: 0% !important;
     width: 100% !important;
     height: 100% !important;
     object-fit: cover !important;
     z-index: 0 !important;
   }
   .navbar {
     position: absolute !important;
     top: 1.875rem !important;
     left: 0 !important;
     right: 0 !important;
     z-index: 100 !important;
   }
   .container-large.nav {
     display: flex !important;
     align-items: center !important;
     justify-content: space-between !important;
   }
   .nav-menu {
     display: flex !important;
     align-items: center !important;
     gap: 1.5rem !important;
   }
   ```

---

## 6. How to Run & Verify

```bash
# Install dependencies
bun install

# Start local dev server (port 8080)
bun run dev

# Build for production
bun run build
```

The original working visual reference can be checked by opening [`public/index.html`](file:///home/skipp/Documents/projects/marmo/privatum/public/index.html).
