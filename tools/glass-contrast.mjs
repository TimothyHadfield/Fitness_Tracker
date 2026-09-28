// Glass contrast check — run by hand after ANY change to the glass tint, blur
// or grain (overhaul design V-4). Headless WebKit, the demo account, the real
// css/app.css: for each route × palette × theme it scrolls the list to five
// offsets so content passes under the phone tab bar, screenshots the band behind
// each non-selected tab label, and reports the WORST rendered contrast between
// the label colour and the pixels behind it.
//
//   node tools/glass-contrast.mjs
//   ROUTES=home,graphs PALS=gold,ember node tools/glass-contrast.mjs
//   SHOTS=<folder> node tools/glass-contrast.mjs   (also saves each screen)
//
// Pass mark: 4.5:1 (WCAG AA). Measured at design time (2026-09-27, 80 % dark /
// 78 % light tint): worst 5.98:1. Never lower the tint below 76 % without
// running this. Exit code 1 when any combination is under the mark.
//
// ⚠️ Method (from the design analyst's contrast.mjs): pixels within 1.25:1 of
// the label colour are the glyph itself and are dropped, then the lowest 40 %
// of what remains (glyph anti-aliasing) — the smallest value left is the worst
// real background. A solid accent button parked exactly under a label at an
// offset not tried can still be missed.
//
// Needs Playwright from ~/.claude/tools. Serves the repo itself on a free port
// (no python server needed) and blocks Google/Firebase so nothing live is hit.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire(path.join(os.homedir(), '.claude', 'tools', 'node_modules') + path.sep);
const { webkit } = require('playwright');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASS = 4.5;
const routes = (process.env.ROUTES || 'home,me,settings,graphs,calendar,workouts,goals').split(',');
const pals = (process.env.PALS || 'gold,teal,indigo,ember').split(',');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const cr = (a, c) => { const x = lum(a), y = lum(c); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const browser = await webkit.launch();
const results = [];
try {
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => sessionStorage.setItem('ftrack:v1:demo', '1'));
    await ctx.route(/(gstatic|googleapis|firebaseio|firebaseapp)\.com/, (r) => r.abort());
    const page = await ctx.newPage();
    for (const pal of pals) for (const r of routes) {
      // The look before the first paint, the way index.html's head script reads it.
      await page.addInitScript(([t, p]) => {
        try { localStorage.setItem('ftrack:v1:look', JSON.stringify({ theme: t, palette: p === 'gold' ? null : p })); } catch (_) {}
      }, [theme, pal]);
      await page.goto(`${base}#/${r}`);
      await page.waitForTimeout(900);
      await page.evaluate(([t, p]) => {
        const root = document.documentElement;
        root.setAttribute('data-theme', t);
        if (p === 'gold') root.removeAttribute('data-palette'); else root.setAttribute('data-palette', p);
      }, [theme, pal]);
      // The demo boots in its own (dark) look, so the flip above is live: give
      // WebKit time to repaint before the first sample (measured: without this
      // the first light sample read 1.87:1 off a half-repainted bar).
      await page.waitForTimeout(400);
      const maxS = await page.evaluate(() => { const p = document.querySelector('.pane-scroll'); return p ? p.scrollHeight - p.clientHeight : 0; });
      let worst = null;
      for (const s of [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxS))) {
        const info = await page.evaluate((s) => {
          const p = document.querySelector('.pane-scroll'); if (p) p.scrollTop = s;
          const nav = document.querySelector('#app > .navbar'); if (!nav) return null;
          // Record (.nav-primary) is left out: its label band crosses its own
          // raised gold button, which is not content under the glass.
          const a = [...nav.querySelectorAll(':scope > a:not(.nav-primary)')].filter((x) => x.getAttribute('aria-current') !== 'page');
          if (!a.length) return null;
          const rects = a.map((x) => { const q = x.getBoundingClientRect(); return { x: q.x + 4, y: q.bottom - 8 - 14, w: q.width - 8, h: 14 }; })
            .filter((q) => q.w > 10 && q.y > 0);
          const col = getComputedStyle(a[0]).color.match(/\d+/g).map(Number);
          return { rects, col };
        }, s);
        if (!info) break;
        await page.waitForTimeout(120);
        for (const rc of info.rects) {
          const buf = await page.screenshot({ clip: { x: Math.max(0, rc.x - 2), y: rc.y, width: rc.w + 4, height: rc.h } });
          const px = await page.evaluate(async (b64) => {
            const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            const g = c.getContext('2d'); g.drawImage(img, 0, 0);
            return Array.from(g.getImageData(0, 0, c.width, c.height).data);
          }, buf.toString('base64'));
          const bg = [];
          for (let i = 0; i < px.length; i += 4) { const v = cr([px[i], px[i + 1], px[i + 2]], info.col); if (v > 1.25) bg.push(v); }
          bg.sort((m, n) => m - n);
          const rest = bg.slice(Math.floor(bg.length * 0.4));
          const v = rest.length ? rest[0] : null;
          if (v && (!worst || v < worst.v)) worst = { v, s };
        }
      }
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${theme}-${pal}-${r}.png` });
      if (worst) results.push({ theme, pal, route: r, worst: Number(worst.v.toFixed(2)), atScroll: worst.s });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

results.sort((a, b) => a.worst - b.worst);
for (const x of results.slice(0, 12)) console.log(JSON.stringify(x));
const low = results.filter((x) => x.worst < PASS);
console.log(`checked ${results.length} combinations · worst ${results[0] ? results[0].worst : 'n/a'}:1 · ${low.length} under ${PASS}:1`);
process.exit(low.length || !results.length ? 1 : 0);
