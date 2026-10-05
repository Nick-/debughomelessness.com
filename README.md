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

Missing population, boundaries, SPM metrics, and Functional Zero assessments
remain unavailable. PIT counts alone do not establish Functional Zero status.
Dashboard totals include only CoCs reporting in the latest common PIT year;
historical references remain accessible through the API and detail pages.

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

Public data is supplied by HUD. This project is licensed under the MIT License.
