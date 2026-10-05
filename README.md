# Homelessness KPI Tracker

A React dashboard and public read-only API for aggregate homelessness data.
Cloudflare Workers serves the app and API; Cloudflare D1 stores verified imports.
The production site is [debughomelessness.com](https://debughomelessness.com).

## Data

The initial import uses HUD's [2025 AHAR PIT release](https://www.huduser.gov/portal/datasets/ahar/2025-ahar-part-1-pit-estimates-of-homelessness-in-the-us.html),
published in May 2026, with 2022–2025 history. The 2025 dataset covers 386 CoCs and
745,652 people. PIT estimates describe one night in January. HUD carries forward
unsheltered estimates for some communities in sheltered-only count years.

Every page shows dataset years, HUD publication period, actual import time,
and the next expected dataset. January 2026 counts are the expected next annual
dataset; HUD has not announced a publication date on its AHAR release pages.
That expectation is not a scheduled site update. Imports are reviewed manually.

Missing population, SPM metrics, and current Functional Zero assessments
remain unavailable. PIT counts alone do not establish Functional Zero status.
The Functional Zero page separately lists Community Solutions' documented
historical milestones for 14 communities and the veteran/chronic populations
covered. It includes a source link and review date. These achievements are not
current CoC assessments; community boundaries may differ from HUD CoC boundaries.
Built for Zero no longer uses Functional Zero as an active designation.
Dashboard totals include only CoCs reporting in the latest common PIT year;
historical references remain accessible through the API and detail pages.

The dashboard's clickable CoC map uses HUD's FY2024 grantee-area boundaries,
simplified for display, with the latest imported PIT counts. Search by CoC name,
ID, or state abbreviation, filter by state, and select a region or list entry to
view counts and open its detail page. Regional map views include Alaska, Hawaii,
Puerto Rico/U.S. Virgin Islands, and Guam. CoCs with no matching boundary remain
accessible in the searchable list; boundary year and coverage appear below the map.
Population and Functional Zero status remain unavailable when not imported.

The checked-in boundary snapshot is generated from the official HUD layer with
`node scripts/prepare-coc-boundaries.mjs`. The script validates IDs and geometries
and saves source metadata in `frontend/public/data/coc-boundaries.json`. Review
the layer's stated coverage year before updating the script for a new vintage.
The map is served from the site's own assets; background tiles use OpenStreetMap.

## Local development

Use Node.js 24 (minimum 22.12).

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Open http://127.0.0.1:18787. For frontend hot reload, also run
`npm run dev:frontend` and open http://localhost:3000. Vite proxies `/api` to the
local Worker. `VITE_API_URL` is optional and defaults to the same origin.

VS Code F5 supports **Debug dashboard (Edge)** and **Debug Cloudflare Worker**.
Launch tasks apply local migrations and start the required servers. Stop them
with **Tasks: Terminate Task** when finished.

## Verified data import

Python 3.10+ is used only to extract HUD's binary Excel source files. The app,
API, database, validation, and deployment run with Node.js and Cloudflare.

```sh
python -m pip install -r scripts/requirements-import.txt
python scripts/prepare-hud-import.py --download
python -m unittest discover -s scripts -p "test_hud_import.py"
npx wrangler d1 execute DB --local --file data/import/hud-pit.sql
```

Preparation checks unique IDs, nonnegative integer counts, sheltered/unsheltered
reconciliation, national totals, and agreement with the separate HUD state
workbook before writing SQL. Each metric retains its year and source URL, and
the manifest records SHA-256 checksums. HUD's `MO-604a` footnote is normalized to
`MO-604`, with Missouri and Kansas coverage. Upserts are safe to repeat and leave
missing assessments and populations untouched.

Review `data/import/hud-pit-manifest.json` and the local dashboard, then export a
remote backup, apply pending migrations, and import:

```sh
npx wrangler d1 export DB --remote --output data/before-import.sql
npm run db:migrate:remote
npx wrangler d1 execute DB --remote --file data/import/hud-pit.sql
npm run smoke
```

The database records import time when SQL is applied. Source files, generated
SQL, manifests, and backups under `data/` are ignored by Git. Update source
constants and release expectations in the preparation script when a new HUD
release is verified. No recurring import or monitor is installed.

## Validation and release

`npm run validate` runs API tests, the React build, a Workers dry run, and runtime
smoke tests against a temporary D1 database. `npm run deploy` validates, applies
remote migrations, deploys, and checks production.

See [setup](docs/SETUP.md), [development](docs/DEVELOPMENT.md),
[API documentation](docs/API.md), and [Cloudflare deployment](docs/CLOUDFLARE.md).

## Project structure

- `frontend/`: React pages and source/update notice.
- `worker/`: Cloudflare API and SQLite-backed API tests.
- `database/d1/migrations/`: additive D1 schema changes.
- `scripts/`: source validation, runtime checks, and smoke tests.
- `docs/`: setup, API, and release instructions.

PIT data is supplied by HUD; historical Functional Zero milestones are sourced
from [Community Solutions](https://community.solutions/built-for-zero/functional-zero/).
The milestone snapshot is reviewed manually in `worker/src/functional-zero-achievements.js`.
This project is licensed under the MIT License.
