# Development setup

Install Node.js 24 (22.12+ supported), then run from the repository root:

```sh
npm ci
npm run db:migrate:local
npm run dev
```

The React app and Workers API run at http://127.0.0.1:18787. D1 uses local SQLite
storage under `.wrangler/`. No separate database service is required.

For frontend hot reload, leave the Worker running and run
`npm run dev:frontend` in another terminal. Open http://localhost:3000.
Vite proxies API requests to port 18787. Leave `VITE_API_URL` empty for the
default same-origin API; an override belongs in `frontend/.env.local`.

The local database starts empty. Follow the [verified import instructions](../README.md#verified-data-import)
to download HUD workbooks, validate them, and load local data. Python 3.10+ and
`scripts/requirements-import.txt` are needed only for workbook extraction.

VS Code F5 launch configurations apply migrations and start the app before
attaching Edge or the Worker debugger. Avoid duplicate servers on the same
ports. Stop background launch tasks through **Tasks: Terminate Task**.

Run `npm run validate` before releasing. Runtime checks use temporary D1
storage and their own ports (18788 and 19230), leaving the development database
untouched. See [the release protocol](CLOUDFLARE.md).

If the UI cannot load, verify `/health` on the local Worker and check migrations.
An empty collection is a successful response with no imported records. Missing
assessments remain unavailable.
