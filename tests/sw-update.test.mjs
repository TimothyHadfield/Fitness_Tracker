// Does the app notice a deploy? End-to-end, against a real service worker.
//
//   node tests/sw-update.test.mjs        (needs Chrome; no other dependencies)
//
// ⚠️ THIS IS THE ONE TEST THAT CANNOT BE FAKED, and docs/handbook.md §0.7 says why:
// a service worker is its own target, so emulated offline sails past it and a
// stubbed cache proves nothing. So this copies the app to a scratch directory,
// serves it over real HTTP, lets the worker install, then EDITS A FILE ON DISK
// — an actual deploy — and asserts the running page offers a refresh.
//
// It never touches the repo: everything happens in a temp copy, which matters
// because the test's whole method is modifying a source file.
//
// Why it exists: Tim shipped a change, reloaded, and did not see it. The cause
// was stale-while-revalidate serving the previous version for one load — by
// design (sw.js explains the trade) but indistinguishable from a broken
// feature. The refresh notice is the fix and this is its proof.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, cpSync, appendFileSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9378;
const CDP_PORT = 9377;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- a scratch copy, so the real app is never edited ---------- */

const dir = mkdtempSync(join(tmpdir(), 'sw-update-'));
for (const f of ['index.html', 'manifest.webmanifest', 'icon.svg', 'sw.js', 'css', 'js', 'img']) {
  if (existsSync(join(REPO, f))) cpSync(join(REPO, f), join(dir, f), { recursive: true });
}
// Never point a test at the live Firebase project.
writeFileSync(join(dir, 'js', 'firebase-config.js'),
  'export const IS_CONFIGURED = false;\nexport const FIREBASE_CONFIG = {};\n');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp',
};
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(dir, path === '/' ? 'index.html' : path);
  if (!existsSync(file) || !file.startsWith(dir)) { res.writeHead(404); res.end(); return; }
  const body = readFileSync(file);
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
    // ⚠️ The FILE'S mtime, not the clock. Stamping `new Date()` here made every
    // asset look changed on every request, so the notice fired on a normal load
    // and the test failed in a way that read as an app bug and was a harness
    // bug. A real server sends the file's own modification time; so must this.
    'Last-Modified': statSync(file).mtime.toUTCString(),
    'Cache-Control': 'no-cache',
  });
  res.end(body);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

/* ---------- drive Chrome ---------- */

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${join(tmpdir(), 'cdp-sw-' + process.pid)}`,
  '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) wsUrl = page.webSocketDebuggerUrl;
  } catch (_) { /* not up yet */ }
  if (!wsUrl) await sleep(250);
}
if (!wsUrl) { console.log('FAIL  Chrome never started'); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((res) => {
  const n = ++id; pending.set(n, res);
  ws.send(JSON.stringify({ id: n, method, params }));
});
const js = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return r.result && r.result.result && r.result.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
const URL_ = `http://127.0.0.1:${PORT}/`;

// First load installs the worker; the second is controlled by it.
await send('Page.navigate', { url: URL_ }); await sleep(2500);
await send('Page.navigate', { url: URL_ }); await sleep(2500);

ok(await js('!!navigator.serviceWorker.controller'),
   'the service worker takes control on the second load');
ok(!(await js("!!document.querySelector('.update-bar')")),
   'no update notice on a normal load — it must never nag');

/* ---------- deploy ---------- */

appendFileSync(join(dir, 'css', 'app.css'), '\n/* deploy marker */\n');
await sleep(1200);
await send('Page.navigate', { url: URL_ }); await sleep(3000);

ok(await js("!!document.querySelector('.update-bar')"),
   'after a deploy the page OFFERS a refresh');
ok(/new version/i.test(await js("(document.querySelector('.update-bar')||{}).textContent||''")),
   'and says plainly what it is');
ok(await js("!!document.querySelector('.update-bar .btn')"), 'with a Refresh button');
// The important negative: a worker must never reload somebody mid-set.
ok(await js("!!document.querySelector('#app .screen')"),
   'and the app is untouched behind it — it offers, it does not reload');

await js("document.querySelector('.update-bar [aria-label=Dismiss]')?.click()");
await sleep(300);
ok(!(await js("!!document.querySelector('.update-bar')")), 'dismissing it removes it');

await send('Page.navigate', { url: URL_ }); await sleep(2500);
ok(await js("fetch('css/app.css').then(r=>r.text()).then(t=>t.includes('deploy marker'))"),
   'and the next load really does serve the new file');

/* ---------- ⚠️ THE RESUMED APP — a deploy spotted with NO page load ----------
   Everything above navigates, and navigating is the one thing an installed
   home-screen app does NOT do when you reopen it: iOS resumes the document
   that was already there, so nothing is fetched and the worker is never
   consulted. The update machinery could work perfectly and still never fire.

   Tim reported exactly this on 2026-08-22 — a feature live for hours that his
   phone had simply never asked about. So: deploy a change and then, WITHOUT
   navigating, do what coming back to the app does. */
// ⚠️ A fresh worker generation first. `announceUpdate` deliberately speaks ONCE
// per worker lifetime — a deploy changes a dozen files and the user needs one
// sentence, not twelve — so the phase above has already spent this worker's
// announcement. Editing sw.js itself installs a new one, which is the only
// honest way to get back to a state where an update can still be announced.
appendFileSync(join(dir, 'sw.js'), '\n// new worker generation\n');
await send('Page.navigate', { url: URL_ }); await sleep(3000);
await send('Page.navigate', { url: URL_ }); await sleep(2500);
ok(!(await js("!!document.querySelector('.update-bar')")),
   'a fresh worker with nothing new to report says nothing');

appendFileSync(join(dir, 'js', 'ui.js'), '\n// resume marker\n');
await sleep(1200);
ok(!(await js("!!document.querySelector('.update-bar')")),
   'and the deploy ALONE does not reach a page that is just sitting there');

// What coming back to an installed app does — and nothing else. No navigation,
// which is the whole point: that is what iOS does not do on resume.
await js(`(async () => {
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((r) => setTimeout(r, 2500));
})()`);

ok(await js("!!document.querySelector('.update-bar')"),
   '⚠️ reopening the app finds a deploy with NO navigation at all — the installed-PWA case');
ok(/new version/i.test(await js("(document.querySelector('.update-bar')||{}).textContent||''")),
   'and offers the same refresh, rather than reloading somebody mid-set');

console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
ws.close();
chrome.kill();
server.close();
process.exit(fails === 0 ? 0 : 1);
