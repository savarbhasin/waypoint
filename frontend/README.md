# Waypoint

Browser workflow studio for the `record → process → run` pipeline in `../src/`.

## Run

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What it does

- Browse and edit workflow JSON that mirrors `src/models.py` exactly
- Import/export files compatible with `python src/main.py run`
- Dry-run preview that mirrors `src/runner.py` decision logic
- **Source tab** — live snippets from `../src/` (runner, recorder, enricher, extractor, etc.)

## Stack

Next.js 15 · React 19 · Tailwind CSS 4 · Zustand
