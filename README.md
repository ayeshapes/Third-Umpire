# Third Umpire — PSL Analytics Platform

A Pakistan Super League analytics platform: ball-by-ball scraper → PostgreSQL →
FastAPI → Next.js. This is a modernization of an existing project — the
scraper, ETL, database schema, and all analytics query logic are preserved
from the original codebase. What changed is the presentation layer: a
single-file FastAPI script + plain HTML frontend became a modular REST API
+ a proper Next.js application.

## What's in this repo

```
third-umpire/
  backend/      FastAPI REST API (modular routers, preserves all original query logic)
  frontend/     Next.js 15 (App Router) + TypeScript + Tailwind — the new UI
  scrapers/     Original scraper + ETL scripts (unchanged)
  database/     Original PostgreSQL schema (unchanged)
  dbt/          Placeholder for future dbt models
  docs/         Architecture notes
  assets/       Brand assets
```

## Status

**Done:** backend fully modularized and verified against the live schema;
frontend has a working design system, landing page, overview dashboard,
players (search + profile), teams (list + detail), matches, seasons,
venues (list + detail, with a Leaflet map when coordinates exist), records,
head-to-head, and analytics pages, all wired to real endpoints with graceful
fallback if the API is unreachable. A global Cmd+K command palette searches
players/teams/venues from anywhere in the dashboard. Full `npm run build`
and `eslint` pass clean.

**Not yet built:** Leaflet venue maps only render when a venue has lat/lng
in the database (some rows won't); season/team/player comparison UIs (the
backend endpoints for these — `/api/seasons/compare`, `/api/matchup`,
`/api/batter-vs-bowling-type` — already exist and are typed in
`frontend/lib/api.ts`, just not wired to a page yet); and auth (intentionally
deferred per the original spec).

## Running locally

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL to your Postgres instance
uvicorn app.main:app --reload
```

API docs at `http://127.0.0.1:8000/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL if not localhost:8000
npm run dev
```

App at `http://127.0.0.1:3000`.

## Backend architecture

`backend/app/`:

- `main.py` — FastAPI app, CORS, router registration
- `routers/` — one file per resource (`health`, `overview`, `seasons`, `teams`,
  `matches`, `players`, `venues`, `leaderboards`, `analytics`). Every route's
  SQL/business logic was moved verbatim from the original `dashboard/backend/main.py`
  — nothing was rewritten during the split.
- `database/connection.py` — the psycopg2 connection helper (unchanged from
  the original)
- `utils/cricket.py` — the shared overs-to-balls conversion helper, previously
  duplicated inline, now centralized

One new endpoint, `/api/overview`, was added (see the docstring in
`routers/overview.py`) because the new dashboard's KPI cards need a few
league-wide totals that no single original endpoint returned together.

## Frontend design system

Theme: "night match under lights" — deep red (`#a8112c`), near-black
(`#0a0a0b`), ivory, with a scoreboard-amber accent (`#e8a33d`) used sparingly
for standout numbers. Display type is Oswald (condensed, scoreboard-adjacent),
body text is Inter, and every stat/number uses JetBrains Mono in tabular-nums
so digits don't jitter — that's the signature "scoreboard digit" look used in
`components/shared/stat-card.tsx` and throughout.

Fonts are self-hosted via `@fontsource/*` (not `next/font/google`) since this
build environment can't reach Google's font CDN — swap back to `next/font/google`
if you'd prefer, it'll work fine wherever you actually deploy.

## Deployment

- **Frontend → Vercel**: `frontend/vercel.json` is set up; add
  `NEXT_PUBLIC_API_URL` as an environment variable pointing at your deployed
  backend.
- **Backend → Railway**: `backend/railway.json` + `Procfile` are set up;
  add `DATABASE_URL` as an environment variable pointing at your Railway
  Postgres instance.
