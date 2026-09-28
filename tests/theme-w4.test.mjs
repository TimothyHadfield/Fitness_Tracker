// Theme Auto really follows the phone, and a later fixed choice really sticks.
//
//   node tests/theme-w4.test.mjs      (needs Playwright's WebKit, from ~/.claude/tools)
//
// Two bugs a reviewer measured on 2026-09-27, both invisible to a DOM stub
// because they live in the MutationObserver hand-off between Settings
// (views-data.js) and the boot code (app.js) — so this drives Safari's engine
// against the real app and flips the phone's colour scheme with emulateMedia.
//
//   (9)  Settings wrote the RESOLVED 'dark'/'light' when Auto was tapped, so
//        app.js recorded a fixed choice and Auto ignored the phone until a
//        relaunch (and the look cache stored 'dark').
//   (10) A boot that resolved Auto itself left `selfThemeWrite` set with no
//        observer to clear it, so a later tap on Light read as "our own write"
//        and the phone kept driving the theme.
//
// Serves the repo read-only over HTTP; the Firebase config is swapped for a
// not-configured stub in the browser (never the live project), and service
// workers are blocked so nothing is cached between steps.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';

let webkit;
try {
  ({ webkit } = createRequire(join(homedir(), '.claude', 'tools', 'node_modules', '/'))('playwright'));
} catch (_) {
  console.log('SKIP  Playwright is not installed at ~/.claude/tools — theme-w4 needs WebKit');
  process.exit(0);
}

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
};
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(REPO, path === '/' ? 'index.html' : path);
  if (!file.startsWith(REPO) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/`;

const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true,
  colorScheme: 'light', serviceWorkers: 'block',
});
await context.route(/(gstatic|googleapis|firebaseio|firebaseapp)\.com/, (r) => r.abort());
await context.route('**/js/firebase-config.js', (r) => r.fulfill({
  contentType: 'text/javascript',
  body: 'export const IS_CONFIGURED = false;\nexport const FIREBASE_CONFIG = {};\n',
}));
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const shown = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const cachedTheme = () => page.evaluate(() => {
  try { return (JSON.parse(localStorage.getItem('ftrack:v1:look') || 'null') || {}).theme; } catch (_) { return null; }
});
const settle = () => page.waitForTimeout(400);
const chip = (name) => page.locator('.chip', { hasText: new RegExp(`^${name}$`) }).first();
// ⚠️ Via about:blank, so it is a real BOOT every time. A goto that only
// changes the hash is a same-document navigation — app.js never re-runs, and
// the first draft of (10) passed on the unfixed code because of exactly that.
const openSettings = async () => {
  await page.goto('about:blank');
  await page.goto(URL_ + '#/settings');
  await chip('Auto').waitFor({ timeout: 20000 });
  await settle();
};

/* ---------- (9) tapping Auto follows the phone, live ---------- */

await openSettings();
ok(await shown() === 'dark', 'a fresh install starts Dark (absence = dark)');

await chip('Auto').click(); await settle();
ok(await shown() === 'light', 'tapping Auto on a light-mode phone shows Light');
ok(await cachedTheme() === 'auto', '(9) and the look cache remembers AUTO, not the colour it resolved to');

await page.emulateMedia({ colorScheme: 'dark' }); await settle();
ok(await shown() === 'dark', '(9) the phone switching to dark takes the app with it — no relaunch');
await page.emulateMedia({ colorScheme: 'light' }); await settle();
ok(await shown() === 'light', '(9) and back to light again');

/* ---------- (10) after a boot that resolved Auto, Light sticks ---------- */

// A boot where the saved setting is Auto but this device's look cache is not
// (a new device, cleared storage, or a cache the old bug wrote as 'dark'):
// the head script paints dark, then boot resolves Auto to light itself.
await page.evaluate(() => localStorage.removeItem('ftrack:v1:look'));
await openSettings();
ok(await shown() === 'light', 'a boot with Auto saved resolves it against the light phone');

await chip('Light').click(); await settle();
ok(await shown() === 'light', 'tapping Light shows Light');
await page.emulateMedia({ colorScheme: 'dark' }); await settle();
ok(await shown() === 'light', '(10) and it STAYS Light when the phone goes dark — the choice is fixed now');
ok(await cachedTheme() === 'light', '(10) and the look cache says light');
await page.emulateMedia({ colorScheme: 'light' });

/* ---------- (16) the "More details" ? sits beside its label ---------- */

await openSettings();
const beside = await page.evaluate(() => {
  const label = [...document.querySelectorAll('label')].find((l) => l.textContent.trim() === 'More details');
  if (!label) return { found: false };
  const dot = label.parentElement && label.parentElement.querySelector('.help-dot');
  if (!dot) return { found: true, dot: false };
  const a = label.getBoundingClientRect(); const b = dot.getBoundingClientRect();
  return { found: true, dot: true, gap: Math.round(b.left - a.right), sameLine: Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 12 };
});
ok(beside.found && beside.dot, '(16) the "More details" ? is in the label\'s own line, not after the description');
ok(beside.sameLine && beside.gap >= 0 && beside.gap < 24,
   `(16) and sits right beside the label (gap ${beside.gap}px, same line ${beside.sameLine})`);
ok(await page.locator('text=Your ranking doesn\'t change.').count() === 1,
   'and "Your ranking doesn\'t change." stays in the open, never behind the ?');

ok(errors.length === 0, `no page errors (${errors.join(' | ') || 'none'})`);

if (process.env.THEME_SHOT) {
  await page.locator('label', { hasText: 'More details' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: process.env.THEME_SHOT });
}

await browser.close();
server.close();
console.log(fails === 0 ? '\nAll checks passed.' : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
