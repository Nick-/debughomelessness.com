# Development guide

The application has one Workers API (`worker/src/index.js`), one React frontend,
and one D1 database. Use `codex/` for new task branches and concise conventional
commit messages. Use functional React components and two-space JavaScript
indentation.

## Validation

- `npm test`: API tests against SQLite with the current D1 migrations.
- `npm run build`: production frontend build.
- `npm run check`: tests, frontend build, and Workers deploy dry run.
- `npm run test:runtime`: local Workers/D1 smoke checks with temporary storage.
- `npm run validate`: complete release validation.
- `python -m unittest discover -s scripts -p "test_hud_import.py"`: import tests after installing `scripts/requirements-import.txt`.

## API and schema changes

Add routes in `worker/src/index.js`, update `docs/API.md`, and test validation,
missing data, and response values in `worker/test/api.test.js`. The public API
supports only GET and HEAD. Bind SQL parameters for request input.

Add backward-compatible migrations to `database/d1/migrations/` with sequential
numbers. Never modify an already applied migration. Validate locally before
running `npm run db:migrate:remote`. Export a D1 backup before risky data changes.

## Frontend changes

Pages live in `frontend/src/pages/`, shared components in
`frontend/src/components/`, and API calls in `frontend/src/services/api.js`.
`DataFreshness` displays actual import metadata from `/api/data-status` across
all pages. Preserve unavailable states and label count years explicitly.

## Source updates

Verify the release on HUD's AHAR pages, update source constants and release
expectations in `scripts/prepare-hud-import.py`, and validate workbook headers,
CoC IDs, and national totals. Compare with the separately published state
workbook. Preserve source URLs and years on metrics. Review the generated
manifest and local app before applying remote SQL. Preparation only writes local
files. No automatic import schedule is configured.

Dashboard totals use the latest common PIT year. Retired CoCs may have history
but are excluded from that year's summary. Do not infer Functional Zero
achievement, population, or a live census from annual PIT counts.

See [the deployment protocol](CLOUDFLARE.md) for direct releases and rollback.
