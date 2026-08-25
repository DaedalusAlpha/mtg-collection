# MTG Checklist Builder

A mobile web app for logging Magic: The Gathering cards across multiple
sets in one sitting, then exporting combined Deckbox and Manabox import
CSVs. Pick your sets, fill in per-set checklists on tabs, export.

This is a mobile-first companion to the `checklist.py` desktop tool in the
TTQA Projects/MTG repo — same color/rarity/sort/foil-split logic and the
same Deckbox/Manabox CSV formats, but running live in the browser against
Scryfall's API across as many sets as you want in one session, instead of
one static HTML file per set.

## Develop

```bash
npm install
npm run dev -- --host
```

`--host` exposes the dev server on your LAN so you can open it on your
phone (same wifi) at the printed `http://<your-ip>:5173` address.

## Build

```bash
npm run build   # type-checks then builds to dist/
npm run preview # serve the production build locally to sanity-check it
```

## Deploy (GitHub Pages)

A workflow at `.github/workflows/deploy.yml` builds and publishes `dist/`
to GitHub Pages on every push to `main`. To wire it up:

1. Create a repo under your GitHub account and push this project to it.
2. In the repo's Settings → Pages, set **Source** to "GitHub Actions".
3. Push to `main` — the workflow builds and deploys automatically.

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

The Vite config uses a relative base path, so it works at whatever
`https://<user>.github.io/<repo>/` URL Pages gives you — no need to hardcode
the repo name anywhere.

## How data flows

- `src/scryfall.ts` — fetches the paper set list and, per selected set,
  paginates through Scryfall's card search (same query as the desktop
  tool's `search_set()`).
- `src/cardModel.ts` — turns raw Scryfall cards into sorted rows: color
  category (single color / multicolor / colorless / land), mana cost pips,
  and a nonfoil/foil row split per printing — ported from `checklist.py`'s
  `_build_rows`.
- `src/state.ts` — holds all app state (selected sets, per-set card cache,
  filters, logged counts) and persists counts + selection to `localStorage`
  so a reload mid-checklist doesn't lose progress.
- `src/csv.ts` — builds the Deckbox and Manabox CSVs (same column headers
  as `checklist.py`'s generated HTML) and triggers the browser download.
