# Cloudflare Workers deployment

The React dashboard, static assets, dataset API, and traffic collector deploy together as the
`debughomelessness` Worker. D1 supplies the database through the `DB` binding.
`wrangler.json` is the source of truth for the domain, account, database, and routing.
The production hostname is https://debughomelessness.com. Client-side routes fall
back to the React app; `/api/*` and `/health` always run the Worker.
`/api/traffic` is a validated, rate-limited POST collector for private diagnostics;
the dataset APIs remain read-only. A daily UTC cron prunes diagnostic sessions
last active more than 30 days ago. See [ANALYTICS.md](ANALYTICS.md) for private reports.

## Initial production release

Deployed and verified on October 4, 2026 (America/New_York).

- Account: `nicholasconrad@icloud.com`, ID `9266560766d3741dd4f51cc302ba9caa`.
- D1: `debughomelessness`, ID `96383678-58c2-4b46-9f19-3306d1d73a8a`, region ENAM.
- Applied migration: `0001_initial.sql`.
- Worker version: `4c3c3b0e-bd7d-4f60-b1ce-ec17347d13b0`.
- Production smoke tests passed for health, all three API collections, unknown
  API routes, the homepage, and direct React routes. Browser verification passed.
- The initial deployment started empty. See the data import section for the verified HUD import.
- Releases use local validation and direct Wrangler deployment.

Wrangler's warning about omitted OAuth scopes is expected with this project's
limited login scopes. Workers, D1, and Custom Domain deployment succeeded with
these scopes; unrelated product permissions are unnecessary for this release.

## Verified HUD import release

Released on October 4, 2026 (America/New_York).

- Worker version: `2fb3d190-6b20-43a8-b68d-eb4028c849fb`.
- Applied migration: `0002_data_updates.sql`.
- Imported 4,629 metrics for 2022–2025 and 389 current/historical CoC references.
- The latest count covers 386 reporting CoCs and 745,652 people in January 2025.
- CoC and state workbook totals agree for every imported year and metric type.
- A pre-import D1 export is saved locally at `data/before-import-2026-10-04.sql`.
- The dashboard displays source publication, actual import time, and the next
  expected annual dataset. No Functional Zero assessments were inferred.
- Import tests, API tests, frontend build, Workers dry run, local runtime smoke
  checks, production smoke checks, and production data reconciliation passed.

## Google Analytics release

Deployed and verified on October 5, 2026 (America/New_York).

- Commit: `72ec788` (`Analytics`).
- Worker version: `45a764cc-c04e-44e2-b384-5beb45d475aa`.
- GA4 production stream: `G-01Q4FQHS0X`.
- No pending remote database migrations.
- All 19 tests, production build, Workers dry run, local runtime smoke checks,
  and production smoke checks passed. The live JavaScript bundle contains the
  configured stream ID and browser exclusion.
- Browser verification confirmed the exclusion message persists after reload
  and the excluded browser has no Google tag script. Use
  `https://debughomelessness.com/?analytics=off` once per browser/profile/device.

## Visitor behavior analytics release

Deployed and verified on October 7, 2026 (America/New_York).

- Application commit: `33564d8`; report-link documentation: `49a55c2`.
- Worker version: `097de86f-9839-42bb-a3f4-81e3f5953bae`.
- Tracks CoC searches/selections, shelter exploration, source links, and
  Discord/donation click intent. See [ANALYTICS.md](ANALYTICS.md).
- Registered 16 event dimensions and four key events in the owner's GA4 property.
- All 23 tests, the production build, Workers dry run, isolated local runtime
  checks, and all 13 production smoke checks passed.
- No pending remote database migrations.

## Private traffic diagnostics release

Deployed and verified on October 7, 2026 (America/New_York).

- Worker version: `b8e300e3-8c9c-4251-b8c6-206c30fff789`.
- Applied additive migration `0003_traffic_sessions.sql`; the public dataset tables
  are unchanged. Private reports use the existing owner's D1 credential.
- Records browser sessions, arrival categories, country/ASN/network owner,
  browser version, automation evidence, visible time, and deliberate interactions.
- All 32 tests, production build, dry run, isolated runtime collector/report
  checks, 13 production smoke checks, and live browser verification passed.
- Removed both synthetic verification sessions from the private diagnostics.
- Registered the previously absent account Workers namespace `debughomelessness`
  to satisfy Cloudflare's cron prerequisite. The site's workers.dev route and
  preview URLs remain disabled; the verified daily cleanup is `17 8 * * *` UTC.
- The first release runner stopped after the cron prerequisite error, after
  publishing the Worker. Registration and schedule synchronization completed via
  Cloudflare's API, and live collection, private reads, and retention configuration
  were verified separately.

## Verified unattended deployment

Verified on October 7, 2026 (America/New_York).

- Release runner commit: `9454ae4`.
- Worker version: `46afaa76-79d4-4c63-a1a0-2585c391f358`.
- Created `debughomelessness local deploy` with the account/zone permissions
  documented below and no expiration date. Its status is Active.
- Saved only a Windows DPAPI-encrypted credential outside the repository, with
  access restricted to the current Windows user.
- `npm run deploy` unlocked that credential and completed validation, remote
  migration checks, Worker deployment, and all 13 production smoke checks
  without browser authentication. All 23 tests passed.
- Credential encryption/decryption, environment-token precedence, release step
  order, and stopping before deployment after a migration failure were checked.

## Local setup

Use Node.js 24 (22.12+ also supports the build).

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Open http://127.0.0.1:18787. For React hot reload, also run `npm run dev:frontend`
and open http://localhost:3000; Vite proxies `/api` to Wrangler on port 18787.
These explicit ports avoid Windows reserved port conflicts encountered on this machine.
The default API URL is same-origin. An explicit `VITE_API_URL` overrides it at
build time and should only be used when deliberately targeting another API.

## Authenticate and provision

```sh
npm run cf:login -- --scopes account:read user:read workers:write workers_routes:write workers_scripts:write workers_tail:read d1:write zone:read ssl_certs:write
npm run cf:whoami
npx wrangler d1 list
```

Sign in to the account that owns the domain. The configured account ID is
`9266560766d3741dd4f51cc302ba9caa`. If D1 `debughomelessness` does not exist, run
`npx wrangler d1 create debughomelessness`, then put the returned database ID into
`wrangler.json`. Never deploy with the all-zero placeholder ID.
The domain must be an active Cloudflare zone in that account. Wrangler manages
its Worker Custom Domain and certificate. Resolve any existing conflicting DNS
record deliberately rather than deleting unrelated records.

## Release protocol

1. Review the code and migrations. Run `npm ci` on a fresh checkout.
2. Run `npm run validate` (API tests, React build, Workers dry run, local D1 migrations,
   and smoke tests against the Workers runtime). The runtime check starts and stops
   its own local Worker on port 18788, with inspector port 19230 and a temporary
   D1 database; it does not modify your development database.
3. Run `npm run db:migrate:local` and `npm run dev` for a browser review.
4. Ensure the deployment API token is configured as described below.
5. Run `npm run deploy`. It validates, builds, applies pending remote migrations,
   then deploys the Worker and static assets together and runs production smoke tests.
6. Inspect the dashboard in a browser. `npm run smoke` can also be run independently.
7. Record the deployed version ID printed by Wrangler. Inspect errors with `npm run logs`.

Migrations must be additive/backward compatible, because the database migration
runs before the new Worker takes over. Make a D1 export before any risky schema
or data change: `npx wrangler d1 export DB --remote --output backup.sql`.

To roll back code, run `npx wrangler deployments list`, then
`npx wrangler rollback <previous-version-id>`. This does not roll back D1 data or
schema. Fix database issues with a forward migration; do not remove applied
migration files.

## Deployment without repository-hosted CI

Run the same commands from a local checkout or a runner you control:

```sh
npm ci
npm run validate
# After reviewing the changes and configuring the deployment credential:
npm run deploy
```

`npm run deploy` runs validation before applying remote migrations, deploying,
and checking the live domain. Releases are explicitly invoked; pushing a branch
does not deploy. `npm run check` remains available for tests, a build, and a dry run,
while `npm run test:runtime` runs only the local runtime check after a build.

`npm run deploy` requires a deployment API token and disables interactive login.
It accepts `CLOUDFLARE_API_TOKEN` (or Wrangler's legacy `CF_API_TOKEN`) from the
environment first. On Windows, it otherwise unlocks the saved credential at
`%LOCALAPPDATA%\DebugHomelessness\deploy-token.dpapi`. Windows DPAPI encrypts this
file for the current Windows user; the containing directory permits only that
user. The token stays outside the repository and is passed only to release
subprocesses. A new computer/user needs separate credential provisioning.

The dedicated token configuration is:

- Account `9266560766d3741dd4f51cc302ba9caa`: Workers Scripts Edit, D1 Edit,
  Account Settings Read.
- Zone `debughomelessness.com` only: Workers Routes Edit, Zone Read.
- No expiration date; revoke/rotate it in Cloudflare if needed. Revoked or
  missing credentials stop deployment with an error instead of opening a browser.

To store a replacement token, securely pipe it to
`powershell.exe -NoProfile -NonInteractive -File scripts/deploy-token.ps1 -Action store`.
Do not put the token in command arguments, source files, logs, or chat.
For another runner, set these environment variables in its secret store:

- `CLOUDFLARE_API_TOKEN`: a dedicated token scoped to this account and
  zone, with the permissions listed above.
- `CLOUDFLARE_ACCOUNT_ID`: `9266560766d3741dd4f51cc302ba9caa`.

Do not commit credentials or copy the local OAuth token into a runner. No
repository-host credentials or Actions are needed to validate or deploy.

## Data import

Use the [verified HUD import workflow](../README.md#verified-data-import).
The preparation script downloads official 2025 PIT CoC and state workbooks,
validates 2022–2025 records against national totals and the separate state file,
and writes `data/import/hud-pit.sql` with a source checksum manifest.

Apply all migrations before importing. Imports insert CoC references before
metrics and write `data_updates` metadata last, with the application timestamp.
Upserts preserve missing populations and assessments. Review the SQL and
manifest locally and export a remote backup before remote writes.

```sh
npx wrangler d1 execute DB --local --file data/import/hud-pit.sql
npx wrangler d1 export DB --remote --output data/before-import.sql
npx wrangler d1 execute DB --remote --file data/import/hud-pit.sql
```

Import only aggregate public data. Functional Zero responses return the latest
stored assessment per CoC; missing assessments are not treated as achievement.
The project's rate benchmark is not an official Functional Zero certification.

The site shows January 2025 as the latest PIT count, HUD's May 2026 publication,
and database import time. January 2026 is the expected next annual dataset;
HUD has not announced a publication date on its AHAR release pages. A new release
requires source verification, preparation-script updates, and a reviewed import.
