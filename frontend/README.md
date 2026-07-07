# Waypoint — Web studio

Next.js frontend for browsing workflows, triggering runs, and reviewing history.

Full setup (Postgres, OAuth, worker) is in the [root README](../README.md).

## Run locally

```bash
cp .env.local.example .env.local   # configure DATABASE_URL, BETTER_AUTH_*, OAuth, OPENAI_API_KEY
npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The run worker must be running separately:

```bash
# from repo root
uvicorn src.worker.app:app --host 0.0.0.0 --port 8787
```

## App routes

| Route | Description |
|---|---|
| `/` | Public landing page |
| `/sign-in` | Google / GitHub OAuth |
| `/dashboard` | Control center — live runs, failures, activity |
| `/workflows` | Searchable workflow list |
| `/runs` | Cross-workflow run history |
| `/analytics` | Trends and reliability |
| `/w/{id}` | Workflow editor + live run view |
| `/settings/tokens` | API tokens for the Chrome extension |

## Scripts

```bash
npm run dev          # dev server (Turbopack)
npm run build        # production build
npm run db:migrate   # apply Drizzle migrations
npm run db:studio    # Drizzle Studio
```

## Stack

Next.js 15 · React 19 · Tailwind CSS 4 · Drizzle ORM · Postgres · better-auth · Zustand
