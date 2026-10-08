import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const local = args.includes('--local');
const daysIndex = args.indexOf('--days');
const days = daysIndex < 0 ? 7 : Number(args[daysIndex + 1]);
const outputIndex = args.indexOf('--output');
const output = outputIndex < 0 ? null : args[outputIndex + 1];
const persistIndex = args.indexOf('--persist-to');
const persist = persistIndex < 0 ? [] : ['--persist-to', args[persistIndex + 1]];
if (!Number.isInteger(days) || days < 1 || days > 30 || (outputIndex >= 0 && !output) ||
    (persistIndex >= 0 && (!local || !args[persistIndex + 1]))) {
  throw new Error('Usage: npm run analytics:report -- [--days 1..30] [--local] [--output report.md]');
}

const env = { ...process.env, CI: 'true' };
if (!local && !env.CLOUDFLARE_API_TOKEN && !env.CF_API_TOKEN && process.platform === 'win32') {
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File',
    fileURLToPath(new URL('./deploy-token.ps1', import.meta.url)), '-Action', 'load'],
  { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('Could not unlock the saved Cloudflare credential.');
  if (result.stdout.trim()) env.CLOUDFLARE_API_TOKEN = result.stdout.trim();
}
const start = Math.floor(Date.now() / 1000) - days * 86400;
const where = `WHERE first_seen >= ${start}`;
const counts = `COUNT(*) AS visits, COALESCE(SUM(page_views), 0) AS page_views,
  COALESCE(SUM(visible_10s), 0) AS visible_10s, COALESCE(SUM(interactions > 0), 0) AS interacted`;
const sql = [
  `SELECT ${counts} FROM traffic_sessions ${where}`,
  `SELECT automation_signal, ${counts} FROM traffic_sessions ${where} GROUP BY automation_signal ORDER BY visits DESC`,
  `SELECT country, asn, network_owner, automation_signal, browser_family, browser_version,
    ${counts} FROM traffic_sessions ${where}
    GROUP BY country, asn, network_owner, automation_signal, browser_family, browser_version ORDER BY visits DESC LIMIT 30`,
  `SELECT CASE WHEN utm_source != '' OR utm_medium != '' THEN 'tagged'
    WHEN referrer_host != '' THEN 'referral' ELSE 'unknown/direct' END AS attribution,
    referrer_host, utm_source, utm_medium, ${counts} FROM traffic_sessions ${where}
    GROUP BY attribution, referrer_host, utm_source, utm_medium ORDER BY visits DESC LIMIT 30`,
  `SELECT landing_page, ${counts} FROM traffic_sessions ${where} GROUP BY landing_page ORDER BY visits DESC LIMIT 30`,
].join('; ') + ';';
const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve('wrangler/package.json')), 'bin/wrangler.js');
const result = spawnSync(process.execPath, [cli, 'd1', 'execute', 'DB', local ? '--local' : '--remote', ...persist, '--command', sql, '--json'],
  { cwd: fileURLToPath(new URL('..', import.meta.url)), env, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
if (result.error || result.status !== 0) {
  // CLI errors are useful, but never echo the subprocess environment/credentials.
  if (result.stderr) process.stderr.write(result.stderr);
  throw new Error('Traffic report failed. Apply migration 0003 and verify D1 access.');
}
const queries = JSON.parse(result.stdout);
if (queries.length !== 5 || queries.some(query => !query.success)) throw new Error('D1 returned an incomplete traffic report.');
const clean = value => String(value ?? '—').replace(/[\r\n]/g, ' ').replace(/\|/g, '\\|').replace(/[<>]/g, '').slice(0, 253);
function table(rows) {
  if (!rows.length) return 'No visits recorded yet.\n';
  const keys = Object.keys(rows[0]);
  return `| ${keys.join(' | ')} |\n| ${keys.map(() => '---').join(' | ')} |\n` +
    rows.map(row => `| ${keys.map(key => clean(row[key])).join(' | ')} |`).join('\n') + '\n';
}
const titles = ['Totals', 'Automation signals', 'Networks and browsers (top 30)', 'Arrival sources (top 30)', 'Landing pages (top 30)'];
const report = `# Traffic diagnostics\n\nLast ${days} ${days === 1 ? 'day' : 'days'} ending ${new Date().toISOString()} (UTC).\n\n` +
  'Visits are temporary browser sessions, not unique people. Visible means at least 10 seconds in a visible tab; it does not prove human attention.\n' +
  'Automation signals and referrers can be spoofed. `no_signal` means unknown, not verified human.\n\n' +
  queries.map((query, index) => `## ${titles[index]}\n\n${table(query.results)}\n`).join('');
if (output) writeFileSync(output, report, 'utf8');
process.stdout.write(report);
