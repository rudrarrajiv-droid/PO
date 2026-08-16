# Packwell ERP

A React + TypeScript + Vite frontend backed by Supabase (PostgreSQL), plus an independent Google Apps Script (GAS) system for PO/Dispatch management. This project previously used Firebase and an Express/Prisma backend — **both have been fully removed**. Supabase is now the sole production backend for the web application.

This README is written so that you (or anyone else) can pick this project back up months later and get it running from scratch.

## 1. Prerequisites

- **Node.js 20.x** and **npm** (bundled with Node). The CI pipeline (`.github/workflows/deploy.yml`) builds on Node 20, so use that version locally to avoid surprises. There is no `.nvmrc` in this repo — install Node 20 yourself (e.g. via [nvm](https://github.com/nvm-sh/nvm)).
- **Git**.
- **A Supabase project** you have access to (URL + anon key + database connection string). This project does not create a Supabase project for you.
- Optional: **`psql`** (PostgreSQL client) if you need to apply/inspect the SQL in `supabase/sql/` directly against the database.
- Optional: **`clasp`** (`npm install -g @google/clasp`) only if you need to work on the separate `gas/` Google Apps Script project.

## 2. Fresh Setup After `git clone`

Run these in exact order. Each step notes which directory it runs in.

```bash
# 1. Clone and enter the repo root (this is PO/)
git clone <this-repo-url>
cd PO

# 2. Install dependencies for both the root orchestrator and the frontend app
#    (runs from PO/, delegates into PO/frontend/ automatically)
npm run install:all

# 3. Create frontend/.env (see section 3 below - it does NOT exist after a fresh
#    clone because it's gitignored) and fill in your real Supabase values.

# 4. Start the dev server
#    (runs from PO/, delegates into PO/frontend/)
npm run dev
```

The app will be served by Vite (default `http://localhost:5173`, check the terminal output for the exact port).

**Directory reference for the commands above:**
| Command | Runs from |
|---|---|
| `git clone` / `cd PO` | your machine's working directory |
| `npm run install:all` | `PO/` (root) — internally also runs `npm install` inside `PO/frontend/` |
| `npm run dev` | `PO/` (root) — internally runs `cd frontend && npm run dev` |
| Anything with `npx tsc -b`, `npm run build`, `npm run lint`, `npm run preview` | `PO/frontend/` directly (see section 4) |

## 3. `frontend/.env` — Environment Variables

**Location:** `frontend/.env` (there is no `.env` file at the repo root — the app only reads env vars from inside `frontend/`).

This file is **gitignored** (via the root `.gitignore`'s `*.env` pattern), so it will **not** exist after a fresh `git clone`. You must create it yourself.

Required variables (verified against the current `frontend/.env` on this machine — values below are placeholders, never commit or share the real ones):

```bash
# Direct Postgres connection string, used only by local verification/psql tooling.
# Get this from: Supabase Dashboard → Project Settings → Database → Connection string.
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/postgres?sslmode=require&uselibpqcompat=true

# Supabase client config - browser-safe (protected by Row Level Security).
# Get these from: Supabase Dashboard → Project Settings → API.
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

Notes:
- Only variables prefixed `VITE_` are exposed to the frontend browser bundle (this is a Vite convention). `DATABASE_URL` is **not** prefixed with `VITE_` and is only used by scripts/tooling run in Node, never bundled into the shipped app.
- `VITE_SUPABASE_ANON_KEY` is safe to use client-side by design — access is enforced by Supabase Row Level Security (RLS) policies defined in `supabase/sql/`, not by keeping this key secret.
- If `frontend/.env` is missing or has empty values, the app will build/start but any Supabase call will fail at runtime (see Troubleshooting).

## 4. Install, Run, Build, Typecheck

All of the following can be run either from the root (`PO/`, using the wrapper scripts) or directly from `PO/frontend/`. Both are shown.

| Task | From `PO/` (root) | From `PO/frontend/` (direct) |
|---|---|---|
| Install dependencies | `npm run install:all` | `npm install` |
| Start dev server | `npm run dev` | `npm run dev` |
| Production build | `npm run build` | `npm run build` (runs `tsc -b && vite build`) |
| TypeScript check only | — (no root wrapper) | `npx tsc -b` |
| Lint | — (no root wrapper) | `npm run lint` (runs `oxlint`) |
| Preview a production build | — (no root wrapper) | `npm run preview` |

The build output is written to `frontend/dist/`.

## 5. Supabase Setup: `supabase/sql/` vs `frontend/src/lib/supabase/`

These two locations serve very different purposes and are easy to confuse:

- **`supabase/sql/` — the database schema itself.** These `.sql` files are the authoritative, hand-written record of every table, RLS policy, and RPC function that exists in the live Supabase Postgres database. They are **not run automatically** by any build or CI step — there is no migration runner in this project. To apply a change, you (a human) run the relevant file against the database yourself, e.g.:
  ```bash
  psql "$DATABASE_URL" -f supabase/sql/create_firestore_customers.sql
  ```
  (Substitute the real connection string or export `DATABASE_URL` from `frontend/.env` first.) If you edit a file here, the live database does **not** change until you re-run it — keep the file and the live database in sync manually.

- **`frontend/src/lib/supabase/` — the TypeScript service layer.** This is application code that talks to the *already-provisioned* database using the `@supabase/supabase-js` client (configured from `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`). One file per domain (e.g. `productService.ts`, `jobCardService.ts`, `reelService.ts`, `customerService.ts`). This is where you add/change application read/write logic — it assumes the tables/policies from `supabase/sql/` already exist.

In short: **change the database shape in `supabase/sql/` (and apply it by hand), change how the app queries/writes data in `frontend/src/lib/supabase/`.**

## 6. GAS (`gas/`) — Separate System

`gas/` is a **completely separate, independently deployed Google Apps Script application** (a Google Sheets-bound web app covering PO/Dispatch/Priority/Freight/Dashboard). It:
- Has **no code or data dependency** on the React app or Supabase.
- Is deployed via `clasp` (`clasp push` / `clasp pull`), configured by the root `.clasp.json` (`rootDir: "gas"`).
- Should be treated as out of scope when working on the frontend/Supabase app, and vice versa.

You do not need `gas/` or `clasp` set up to run or build the React app.

## 7. Project Structure — Where Things Live

Verified against the actual repository layout.

```
PO/
├── frontend/                       → React/Vite application (the only deployed app)
│   ├── src/
│   │   ├── pages/                  → page-level UI (one file/folder per route)
│   │   ├── components/             → reusable UI components
│   │   ├── layouts/                → page layout wrappers (e.g. app shell/sidebar)
│   │   ├── contexts/                → React context providers (e.g. auth context)
│   │   ├── data/                    → static/reference data used by the UI
│   │   ├── assets/                  → imported images/icons used by components
│   │   ├── utils/                   → generic frontend utility functions
│   │   ├── lib/
│   │   │   ├── supabase/            → Supabase services - all database reads/writes/RPCs
│   │   │   ├── auth/                → authentication-related helpers
│   │   │   ├── types/               → shared TypeScript types/models
│   │   │   ├── exportUtils.ts       → CSV/Excel export helpers
│   │   │   └── utils.ts             → misc shared helpers
│   │   ├── App.tsx / main.tsx       → app entrypoint and route definitions
│   │   └── App.css / index.css      → global styles
│   ├── public/                      → static assets served as-is (favicon.svg, logo.gif)
│   ├── .env                         → frontend environment variables (gitignored - see §3)
│   ├── package.json                 → frontend dependencies/scripts
│   ├── vite.config.ts               → Vite build configuration
│   ├── tsconfig*.json               → TypeScript project configuration
│   ├── tailwind.config.js / postcss.config.js → styling pipeline configuration
│   └── vercel.json                  → secondary Vercel config (SPA rewrite only - see note below)
│
├── supabase/
│   └── sql/                         → authoritative live database schema/RLS/RPC SQL (23 files)
│
├── docs/
│   ├── Packwell ERP Job Card.pdf    → business reference document
│   └── data-archive/                → historical XLSX/CSV source data (6 files, pre-migration)
│
├── gas/                              → separate, independently-deployed Google Apps Script app
│                                        (PO/Dispatch/Priority/Freight/Dashboard on Google Sheets -
│                                        NOT part of the React/Supabase application)
│
├── .clasp.json                       → GAS deployment config (`clasp push`/`pull` target: gas/)
├── vercel.json                       → primary Vercel deployment config (build + routing)
├── package.json                      → root-level orchestration scripts (delegates to frontend/)
└── .github/workflows/deploy.yml      → CI: deploys to Vercel on push to `main`
```

### Where things live, explained

- **Frontend code changes** — almost everything you'll touch day-to-day is under `frontend/src/`. Pages go in `frontend/src/pages/`, reusable UI in `frontend/src/components/`.
- **Supabase database/schema/RLS/RPC SQL** — lives exclusively in `supabase/sql/` (see §5).
- **Supabase service/query code** — lives in `frontend/src/lib/supabase/` (see §5).
- **Shared TypeScript types** — `frontend/src/lib/types/` for cross-cutting types; most Supabase service files also export their own domain-specific interfaces alongside their functions.
- **Authentication code** — `frontend/src/lib/auth/`.
- **Historical/reference documents** — `docs/`. The ERP reference PDF is at `docs/Packwell ERP Job Card.pdf`; historical XLSX/CSV source data (used during the original Firebase migration) is archived under `docs/data-archive/`.
- **Google Apps Script (GAS) code** — `gas/` only (see §6).
- **Frontend environment variables** — `frontend/.env` (see §3). There is no environment file at the repository root.
- **Deployment configuration** — the root `vercel.json` is the primary Vercel config (build command + SPA routing). `frontend/vercel.json` also exists (SPA rewrite only) but its role relative to the root config has not yet been confirmed against the live Vercel project settings — treat it as needing review, not as something to edit casually. CI/CD lives in `.github/workflows/deploy.yml`.
- **Root `package.json`** — only orchestration scripts (`dev`, `build`, `install:all`) that delegate into `frontend/`. It has no application code of its own.

### Where a developer should NOT casually make changes

- `gas/` and `.clasp.json` — a live, externally deployed system. Changes here affect a real Google Sheet in production and are managed independently of the web app's release process.
- `supabase/sql/*.sql` — these describe what's *already live* in production. Editing a file here does not change the database by itself, and is easy to mistake for "the current state" when it may drift from reality if not kept in sync with manually-applied changes.
- Root `vercel.json` / `frontend/vercel.json` / `.github/workflows/deploy.yml` — deployment-critical; a mistake here can break production builds or routing for everyone.
- `docs/data-archive/` — historical source-data snapshots; treat as read-only archival record, not a place to add or edit active data.

### Where do I find...?

| I need to... | Go to... |
|---|---|
| Change a React page | `frontend/src/pages/` |
| Change reusable UI | `frontend/src/components/` |
| Change page layout/shell | `frontend/src/layouts/` |
| Change auth logic | `frontend/src/lib/auth/` |
| Change Supabase service logic | `frontend/src/lib/supabase/` |
| Change shared TypeScript types | `frontend/src/lib/types/` |
| Change DB schema/RLS/RPC | `supabase/sql/` |
| Find the ERP reference PDF | `docs/Packwell ERP Job Card.pdf` |
| Find historical source data | `docs/data-archive/` |
| Work on Google Apps Script | `gas/` |
| Configure GAS deployment | `.clasp.json` |
| Configure frontend environment | `frontend/.env` |
| Configure Vercel (primary) | `vercel.json` (root) |
| Configure CI/CD | `.github/workflows/deploy.yml` |
| Change frontend build tooling | `frontend/vite.config.ts`, `frontend/tsconfig*.json` |

## 8. Troubleshooting

- **App loads but every page shows a Supabase/network error** → `frontend/.env` is missing or has wrong `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. Recheck §3, restart the dev server (Vite only reads `.env` at startup).
- **`npm run build` fails with TypeScript errors you didn't expect** → run `npx tsc -b` from `frontend/` directly to see the isolated type-check output; `vite build` runs after `tsc -b` in the same script and will not proceed if type-checking fails.
- **Stale/incorrect TypeScript errors after switching branches** → TypeScript's incremental build cache (`tsconfig.tsbuildinfo`-style files) can go stale; re-running `npx tsc -b` usually self-corrects, since it's incremental-aware.
- **`npm install` behaves oddly / wrong dependency versions** → confirm you're on Node 20.x (`node -v`); this repo has been verified against that version via CI.
- **Port already in use when running `npm run dev`** → Vite will automatically try the next available port; check the terminal output for the actual URL.
- **A Supabase query works locally but fails after deploy (or vice versa)** → confirm the deployed environment's `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (set in Vercel project settings) match the Supabase project you expect, and that the relevant RLS policy actually exists in `supabase/sql/` and was applied to that database.
- **You changed a `.sql` file in `supabase/sql/` but nothing changed** → these files are not auto-applied (see §5); you must run the file against the database yourself.

## 9. Deployment Basics

- **CI/CD:** `.github/workflows/deploy.yml` runs on every push to `main`. It checks out the repo, sets up Node 20, and runs `npx vercel --prod` using `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` GitHub secrets.
- **Build:** The root `vercel.json` defines `buildCommand: "cd frontend && npm install && npm run build"` and `outputDirectory: "frontend/dist"` — i.e. Vercel builds only the `frontend/` app; nothing else in the repo is built or deployed.
- **Routing:** Root `vercel.json` also rewrites all non-`/api` routes to `/index.html` (standard single-page-app routing for React Router).
- **Environment variables in production:** must be configured directly in the Vercel project settings (the `VITE_SUPABASE_*` values) — they are not read from any file committed to this repo.
- **GAS is deployed separately** via `clasp`, entirely independent of the Vercel/GitHub Actions pipeline above.

## 10. Fresh-PC Checklist

- [ ] Install Node.js 20.x and Git.
- [ ] `git clone <repo>` then `cd PO`.
- [ ] `npm run install:all`.
- [ ] Create `frontend/.env` with `DATABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (get real values from the Supabase dashboard for the correct project).
- [ ] `npm run dev` from `PO/` and confirm the app loads with real data (not just a blank/error screen).
- [ ] `cd frontend && npx tsc -b` to confirm a clean type-check.
- [ ] `npm run build` (from either `PO/` or `PO/frontend/`) to confirm a clean production build.
- [ ] If you need to touch the database schema, locate the relevant file in `supabase/sql/` first — don't assume it's managed elsewhere.
- [ ] If asked to work on GAS, remember it's `gas/` + `clasp`, entirely separate from everything above.

