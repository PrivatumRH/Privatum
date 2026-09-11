# Dual-Repository Multi-Remote Synchronization Guide

This document outlines the workflow and architecture for synchronizing the Privatum codebase between the **Private Production Repo** (`notadeveloper7/privatum`) and the **Public Open-Source Repo** (`PrivatumRH/privatum`).

---

## 1. Architecture Overview

| Property | Private / Production Repo | Public Open-Source Repo |
| :--- | :--- | :--- |
| **GitHub URI** | `notadeveloper7/privatum` | `PrivatumRH/privatum` |
| **Git Remote** | `origin` | `origin-public` |
| **Branch** | `master` | `master` |
| **Author Name** | `PrivatumRH` (or `NAD7`) | `PrivatumRH` |
| **Author Email** | `dbantifun@gmail.com` (or `notadeveloper7@outlook.com`) | `dbantifun@gmail.com` |
| **Integrations** | Lovable, Render, Production CI/CD | Public GitHub, Community, Open-Source |

---

## 2. Fast Commands

From the project root:

### A. Push to Production Only
Pushes your local `master` branch directly to the private repo (`notadeveloper7/privatum`):
```bash
bun run push:origin
# or: git push origin master
```

### B. Push to Public Open-Source Repo Only
Automatically rewrites all commit authors and committers to `PrivatumRH <dbantifun@gmail.com>` and force-pushes to `origin-public/master`:
```bash
bun run push:public
```

### C. Push to Both Repos Simultaneously
Pushes to production first, then triggers the public author-sanitizing sync:
```bash
bun run push:all
```

---

## 3. How the Public Sync Engine Works

The sync script is located at [`scripts/sync-public.py`](file:///home/skipp/Documents/projects/marmo/privatum/scripts/sync-public.py).

### Under the Hood:
1. **`git fast-export master`**: Streams the entire commit tree, preserves exact commit timestamps, commit messages, and tree hashes.
2. **Byte-Exact Stream Rewriter**:
   - Replaces `author ...` with `author PrivatumRH <dbantifun@gmail.com> <timestamp> <tz>`
   - Replaces `committer ...` with `committer PrivatumRH <dbantifun@gmail.com> <timestamp> <tz>`
   - Replaces `tagger ...` with `tagger PrivatumRH <dbantifun@gmail.com> <timestamp> <tz>`
   - Preserves all binary blobs (images, fonts, WASM, icons) without character corruption.
   - Redirects target ref from `refs/heads/master` to `refs/heads/public-master`.
3. **`git fast-import`**: Generates a clean local branch `public-master`.
4. **`git push origin-public public-master:master --force`**: Publishes the clean history to the public repo.
5. **Zero Disruption to Lovable**: Your local `master` branch and `origin/master` remain 100% intact with original commit hashes so Lovable sync is never broken.

---

## 4. Verifying Remotes & Credentials

To check your remote URLs:
```bash
git remote -v
```

Expected output:
```text
origin          https://ghp_...github.com/notadeveloper7/privatum.git (fetch)
origin          https://ghp_...github.com/notadeveloper7/privatum.git (push)
origin-public   https://ghp_...github.com/PrivatumRH/privatum (fetch)
origin-public   https://ghp_...github.com/PrivatumRH/privatum (push)
```

To verify commit authorship on the public branch:
```bash
git log -n 5 --format="%h %an <%ae> %s" public-master
```

---

## 5. Security & Sensitive Files Policy

The following paths are explicitly untracked and excluded from git via `.gitignore`:
- `.env` / `.env.*` (secrets, private keys, API credentials)
- `backend/.env`, `desktop/.env`, `contracts/.env`
- `technical-docs/` (internal product specifications and notes)
- `contracts/out/`, `contracts/cache/`, `contracts/broadcast/`
- `desktop/src-tauri/target/`
- Build outputs: `dist/`, `.output/`, `.nitro/`, `.wrangler/`
