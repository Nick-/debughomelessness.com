import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
// Invoke the CLI with Node directly so Windows does not need a shell or npm.cmd.
const cli = join(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js');
const state = await mkdtemp(join(tmpdir(), 'debughomelessness-runtime-'));
const base = 'http://127.0.0.1:18788';

async function checkPort(port) {
  const probe = createServer();
  try {
    probe.listen(port, '127.0.0.1');
    await once(probe, 'listening');
  } finally {
    if (probe.listening) await new Promise((resolve, reject) => {
      probe.close(error => error ? reject(error) : resolve());
    });
  }
}

function start(args) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  const done = once(child, 'exit').then(([code, signal]) => {
    if (code !== 0) throw new Error(`Command failed (${signal || code}): ${args.join(' ')}`);
  });
  // The dev server may exit while we are polling; avoid an unhandled rejection.
  done.catch(() => {});
  return { child, done };
}

let server;
async function stopServer() {
  if (!server || server.child.exitCode !== null || server.child.signalCode !== null) return;
  if (process.platform === 'win32') {
    // Wrangler starts child processes. Stop only this invocation's process tree.
    const cleanup = spawn('taskkill', ['/pid', String(server.child.pid), '/T', '/F'], {
      stdio: 'ignore', windowsHide: true,
    });
    await once(cleanup, 'exit');
  } else {
    server.child.kill('SIGTERM');
  }
  await server.done.catch(() => {});
}

const controller = new AbortController();
const interrupt = () => controller.abort(new Error('Runtime validation interrupted'));
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);

try {
  // Refuse to test an unrelated dev server if a validation port is in use.
  await checkPort(18788);
  await checkPort(19230);
  await start([cli, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state]).done;
  // A private D1 state and separate port keep validation independent of local development.
  server = start([cli, 'dev', '--local', '--ip', '127.0.0.1', '--port', '18788',
    '--inspector-port', '19230', '--persist-to', state]);
  const ready = (async () => {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      controller.signal.throwIfAborted();
      try {
        const response = await fetch(`${base}/health`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(2000)]),
        });
        if (response.ok && (await response.json()).database === 'connected') return;
      } catch {
        controller.signal.throwIfAborted();
      }
      await delay(500, undefined, { signal: controller.signal });
    }
    throw new Error('Local Worker did not become healthy within 60 seconds');
  })();
  await Promise.race([ready, server.done.then(() => {
    throw new Error('Local Worker exited before becoming healthy');
  })]);
  await Promise.race([start([join(root, 'scripts/smoke.mjs'), base]).done, server.done.then(() => {
    throw new Error('Local Worker exited during smoke tests');
  })]);
  const traffic = await fetch(`${base}/api/traffic`, { method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '550e8400-e29b-41d4-a716-446655440000', event: 'page_view',
      landing_page: '/', referrer_host: 'github.com', utm_source: '', utm_medium: '', automation: true }),
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
  });
  if (traffic.status !== 204) throw new Error(`Traffic collector returned ${traffic.status}`);
  const privateRead = await fetch(`${base}/api/traffic`, { signal: controller.signal });
  if (privateRead.status !== 405) throw new Error('Traffic collection endpoint allowed public reads');
  await start([join(root, 'scripts/traffic-report.mjs'), '--local', '--persist-to', state, '--days', '1']).done;
  console.log('Workers runtime validation passed.');
} finally {
  controller.abort();
  await stopServer();
  if (dirname(resolve(state)) !== resolve(tmpdir()) ||
      !basename(state).startsWith('debughomelessness-runtime-')) {
    throw new Error(`Refusing to remove unexpected temporary path: ${state}`);
  }
  // On Windows, handles can take a moment to close after the process tree exits.
  await rm(state, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
}
