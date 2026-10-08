import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const deploymentEnvironment = { ...process.env, CI: 'true' };
if (!deploymentEnvironment.CLOUDFLARE_API_TOKEN && !deploymentEnvironment.CF_API_TOKEN && process.platform === 'win32') {
  const credential = spawnSync('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-File',
    fileURLToPath(new URL('./deploy-token.ps1', import.meta.url)), '-Action', 'load',
  ], { encoding: 'utf8', windowsHide: true });
  if (credential.error || credential.status !== 0) {
    console.error('Could not unlock the saved deployment token. Restore it for this Windows user before deploying.');
    process.exit(1);
  }
  const token = credential.stdout.trim();
  if (token) deploymentEnvironment.CLOUDFLARE_API_TOKEN = token;
}

if (!deploymentEnvironment.CLOUDFLARE_API_TOKEN && !deploymentEnvironment.CF_API_TOKEN) {
  console.error('No deployment API token is configured. Set CLOUDFLARE_API_TOKEN or provision the encrypted Windows credential described in docs/CLOUDFLARE.md.');
  process.exit(1);
}
const npmPath = process.env.npm_execpath;
if (!npmPath) {
  console.error('Run this release through npm run deploy.');
  process.exit(1);
}
console.log('Using a deployment API token; browser sign-in is disabled.');
for (const script of ['validate', 'db:migrate:remote', 'deploy:worker', 'smoke']) {
  const result = spawnSync(process.execPath, [npmPath, 'run', script], {
    env: deploymentEnvironment, stdio: 'inherit', windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    console.error(`Release stopped at ${script}.`);
    process.exit(result.status || 1);
  }
}
