# Cloudflare Workers deployment

The React dashboard, static assets, and read-only API deploy together as the
`debughomelessness` Worker. D1 supplies the database through the `DB` binding.
`wrangler.json` is the source of truth for the domain, account, database, and routing.
The production hostname is https://debughomelessness.com. Client-side routes fall
back to the React app; `/api/*` and `/health` always run the Worker.

## Initial production release

Deployed and verified on October 4, 2026 (America/New_York).

- Account: `nicholasconrad@icloud.com`, ID `9266560766d3741dd4f51cc302ba9caa`.
- D1: `debughomelessness`, ID `96383678-58c2-4b46-9f19-3306d1d73a8a`, region ENAM.
- Applied migration: `0001_initial.sql`.
- Worker version: `4c3c3b0e-bd7d-4f60-b1ce-ec17347d13b0`.
- Production smoke tests passed for health, all three API collections, unknown
  API routes, the homepage, and direct React routes. Browser verification passed.
- No production records have been imported. The dashboard shows an empty state.
- Releases use local validation and direct Wrangler deployment.

Wrangler's warning about omitted OAuth scopes is expected with this project's
limited login scopes. Workers, D1, and Custom Domain deployment succeeded with
these scopes; unrelated product permissions are unnecessary for this release.

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
The legacy Python backend remains available for PostgreSQL users.

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
4. Confirm `npm run cf:whoami` shows the configured account.
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
# After reviewing the changes and authenticating to Cloudflare:
npm run deploy
```

`npm run deploy` runs validation before applying remote migrations, deploying,
and checking the live domain. Releases are explicitly invoked; pushing a branch
does not deploy. `npm run check` remains available for tests, a build, and a dry run,
while `npm run test:runtime` runs only the local runtime check after a build.

Interactive releases use `npm run cf:login`. For a noninteractive runner, set
these environment variables in that runner's secret store:

- `CLOUDFLARE_API_TOKEN`: a dedicated token scoped to this account and
  zone, with Workers Scripts Edit, D1 Edit, Workers Routes Edit, Zone Read, and
  the permissions required for Worker Custom Domains (including SSL/certificates
  if needed by the account's token policy).
- `CLOUDFLARE_ACCOUNT_ID`: `9266560766d3741dd4f51cc302ba9caa`.

Do not commit credentials or copy the local OAuth token into a runner. No
repository-host credentials or Actions are needed to validate or deploy.

## Data import

Production starts empty. The UI shows unavailable data rather than mock counts.
The existing Python ETL scripts target PostgreSQL and their downloader contains
example HUD URLs; it does not populate this D1 database. Verified HUD source
selection and ingestion are separate work from deployment.

For an initial import, prepare reviewed SQLite-compatible SQL for the tables in
`database/d1/migrations/0001_initial.sql`, inserting CoC references before metrics
and assessments. Use bound parameters or correctly escaped SQL when generating
imports; preserve source and year on each metric.

```sh
npx wrangler d1 execute DB --local --file data/import.sql
npx wrangler d1 execute DB --remote --file data/import.sql
```

Import only aggregate public data. Functional Zero responses return the latest
stored assessment per CoC; missing assessments are not treated as achievement.
The project's rate benchmark is not an official Functional Zero certification.
