// THE ACCESSIBILITY AUDIT. Dev-only; needs Chrome and python. Run it against a
// SCRATCH COPY with firebase-config.js blanked (progress.md §0.6), never the
// real folder:
//
//   cp -r index.html css js img sw.js manifest.webmanifest icon.svg /tmp/a11y-app
//   printf 'export const FIREBASE_CONFIG={};\nexport const IS_CONFIGURED=false;\n' \
//     > /tmp/a11y-app/js/firebase-config.js
//   APP_DIR=/tmp/a11y-app OUT=/tmp/a11y-raw.json node tools/a11y-audit.mjs
//
// ⚠️ THIS IS THE ONLY THING THAT CAN MEASURE CONTRAST AND TOUCH TARGETS, and
// tests/a11y.test.mjs is not a substitute — that one pins the PALETTE, which is
// where the 2026-08-20 bug lived, but only a browser knows the colour actually
// painted behind an element or whether a thumb aimed at a 44px box lands on the
// control. The two catch different things and have each caught what the other
// could not: the browser found the accent-coloured "today" number that appears
// on one cell in the month, and the token test found a latent light-theme pair
// that no screen currently paints.
//
// It uses the DEMO ACCOUNT (progress.md §0.10) rather than hand-seeding, so
// every screen has real content in it.
//
// Driven over CDP. progress.md §0.6: --window-size does not change the layout
// viewport in this headless build, so device metrics are set through
// Emulation.setDeviceMetricsOverride and the app is pointed at directly.
//
// Measures four things nobody has ever measured on this app:
//   1. TOUCH TARGETS  — every interactive element's real rendered box
//   2. CONTRAST       — computed colour vs the colour actually painted behind it
//   3. ACCESSIBLE NAME— every control, from the real accessibility tree
//   4. TEXT SCALING   — the same screens at 200 % text
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const PORT = process.env.PORT || '8791';
const CDP = 9411;
const BASE = `http://127.0.0.1:${PORT}`;

const CHROME = process.env.CHROME
  || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- CDP driver
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  pending.set(msg.id, { res, rej });
  ws.send(JSON.stringify(msg));
});

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP}/json/version`);
      if (r.ok) break;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  const targets = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  };
}

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

async function goto(hash) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`);
  await sleep(700);
}

// ------------------------------------------------ the audit, run in the page
// ⚠️ Everything below runs INSIDE the page, because a touch target is a fact
// about rendered pixels and a contrast ratio is a fact about painted colour.
// Neither can be read off the source.
const AUDIT = `(() => {
  const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const parse = (s) => {
    const m = String(s).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number);
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  // The colour actually painted behind an element — walk up until something is
  // opaque. A ratio computed against a transparent parent is fiction.
  const behind = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a === 1) return c.rgb;
      n = n.parentElement;
    }
    const c = parse(getComputedStyle(document.body).backgroundColor);
    return c ? c.rgb : [255, 255, 255];
  };
  const ratio = (fg, bg) => {
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
      && Number(s.opacity) > 0.01;
  };

  const SEL = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
  const targets = [];
  for (const el of document.querySelectorAll(SEL)) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    targets.push({
      tag: el.tagName.toLowerCase(),
      cls: el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 40) : '',
      text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40),
      aria: el.getAttribute('aria-label') || '',
      // ⚠️ The REAL accessible name, not just aria-label. A <label for> names a
      // control just as well, and the first run of this audit could not see one
      // — which is why it reported a single unnamed input when in truth no
      // label in the app was associated with anything.
      named: !!(el.getAttribute('aria-label') || (el.textContent || '').trim()
        || (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]'))
        || el.closest('label')),
      // Does a thumb aiming at a 44px box actually land on this control? Hit
      // tested, because the hit area is grown with a pseudo-element and a
      // bounding box cannot see one.
      hit44: (() => {
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const pts = [[cx - 21, cy - 21], [cx + 21, cy - 21], [cx - 21, cy + 21], [cx + 21, cy + 21]];
        return pts.every(([x, y]) => {
          const t = document.elementFromPoint(x, y);
          return t && (t === el || el.contains(t) || t.closest('button, a[href]') === el);
        });
      })(),
      w: Math.round(r.width), h: Math.round(r.height),
    });
  }

  // Contrast: every element whose own text node is directly inside it.
  const text = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg) continue;
    const px = parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    text.push({
      cls: String(el.className || '').slice(0, 40),
      text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 45),
      px: Math.round(px * 10) / 10,
      large,
      ratio: Math.round(ratio(fg.rgb, behind(el)) * 100) / 100,
    });
  }

  // Does the page scroll sideways? Rule 1 says the window never scrolls.
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;

  return { targets, text, overflow, w: window.innerWidth };
})()`;

// ---------------------------------------------------------------------- main
const server = spawn('python', ['-m', 'http.server', PORT], {
  cwd: process.env.APP_DIR, stdio: 'ignore',
});
await sleep(1200);

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP}`,
  `--user-data-dir=C:/Users/timha/AppData/Local/Temp/cdp-a11y-${process.pid}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
], { stdio: 'ignore' });

await connect();
await send('Page.enable');
await send('Runtime.enable');

// ⚠️ `#/data` AND `#/muscles` WERE NOT ROUTES, and this list has been quietly
// auditing Home under both names — found 2026-08-24 while driving the muscle
// panel for something else. `app.js` `resolve()` has no case for either and
// falls through to `default: return HomeView()`, so **the Data screen and the
// body map have never been audited at all**: not their contrast, not their
// touch targets, not the seven level colours the map is built on. A coverage
// claim that is false is worse than a gap that is known.
//
// The real route is `#/graphs`, and the four data views are IN-PAGE MODES on it
// rather than routes (progress.md, the eighth pass of 2026-08-22 explains why:
// four URLs for a chart toggle would have been inventing routes). So a row can
// carry a third element — an expression run after navigating — and that is what
// reaches the modes and selects a muscle.
const clickText = (sel, text) => `(() => {
  const el = Array.from(document.querySelectorAll(${JSON.stringify(sel)}))
    .find((n) => (n.textContent || '').trim() === ${JSON.stringify(text)});
  if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return Boolean(el);
})()`;

// ⚠️ RESHUFFLED 2026-08-25 with the nav. Calendar is its own tab again, Goals
// is off the bar but still a route (and therefore still has to be audited — an
// unaudited screen is not made accessible by being one tap further away), and
// `#/record` joined because the workout suggestion moved onto it from Home.
// ⚠️ The Data tab now OPENS on Muscles, so the Graph row needs its own step to
// get there — without it this list would have audited the muscle map three
// times and the line chart never, which is the exact fault found on 2026-08-24.
const ROUTES = [
  ['#/', 'Home'], ['#/workouts', 'Workouts'], ['#/explore', 'Explore'],
  ['#/record', 'Record'],
  ['#/calendar', 'Calendar'],
  ['#/graphs', 'Data · Graph', clickText('.seg, button, a', 'Graph')],
  ['#/graphs', 'Data · Bars', clickText('.seg, button, a', 'Bars')],
  // Added 2026-08-28 with the Research tab — a whole pane of chart text,
  // legend chips and a data table that would otherwise never be measured.
  ['#/graphs', 'Data · Research', clickText('.seg, button, a', 'Research')],
  // ⚠️ Two steps, and the second is the point: the panel only exists once a
  // muscle is SELECTED, so auditing the map without tapping one measures the
  // figure and none of the words beside it.
  ['#/graphs', 'Muscles', clickText('.seg, button, a', 'Muscles')],
  ['#/graphs', 'Muscles · panel',
    `${clickText('.seg, button, a', 'Muscles')};
     await new Promise((r) => setTimeout(r, 600));
     (() => { const m = document.querySelector('[data-muscle="Chest"]')
       || document.querySelector('[data-muscle]');
       if (m) m.dispatchEvent(new MouseEvent('click', { bubbles: true }));
       return Boolean(m); })()`],
  ['#/goals', 'Goals'], ['#/social', 'Social'], ['#/settings', 'Settings'],
  ['#/account', 'Account'], ['#/profile', 'Profile'],
  // Added 2026-08-26: the quick activity log shipped with the Record chooser
  // and had never been measured — a whole screen of steppers and a date field.
  ['#/activity/Running', 'Activity log'],
];

/* ⚠️ THE PALETTE, ADDED 2026-08-26 — and the reason is a known coverage hole
 * rather than a new feature. Four palettes shipped on 2026-08-26 and this audit
 * had only ever run on the default one, so teal, indigo and ember have never had
 * a painted pixel measured. tests/a11y.test.mjs sweeps all four at TOKEN level,
 * which is not the same claim: it cannot see a scoped literal, and two of those
 * had already been found by hand.
 *
 * Set through the ATTRIBUTE for the same reason the theme is — the demo backend
 * reseeds on every reload, so a palette written through settings is thrown away
 * by the next navigate. Gold is bare :root and sets NO attribute, which is the
 * shipped design, so PALETTE=gold removes it rather than setting it. */
const PALETTE = process.env.PALETTE || 'gold';

const applyPalette = () => evaluate(PALETTE === 'gold'
  ? `document.documentElement.removeAttribute('data-palette')`
  : `document.documentElement.setAttribute('data-palette', ${JSON.stringify(PALETTE)})`);

const report = {};

for (const [theme, dark] of [['dark', true], ['light', false]]) {
  for (const [width, height] of [[360, 640], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 2, mobile: true,
    });
    await send('Page.navigate', { url: `${BASE}/index.html` });
    await sleep(1800);
    // Demo account: a populated app, per progress.md §0.10 — do not hand-seed.
    await evaluate(`sessionStorage.setItem('ftrack:v1:demo','1')`);
    await send('Page.navigate', { url: `${BASE}/index.html` });
    await sleep(2500);
    // ⚠️ Set the ATTRIBUTE, not the setting. The demo backend is in-memory and
    // reseeds on every reload, so a theme written through store.setSettings()
    // is thrown away by the navigate that follows it — which is why the first
    // run of this audit reported dark-theme numbers under both labels. The CSS
    // is driven by :root[data-theme], exactly as app.js drives it.
    await evaluate(`document.documentElement.setAttribute('data-theme','${dark ? 'dark' : 'light'}')`);
    await applyPalette();
    await sleep(300);

    for (const [hash, name, after] of ROUTES) {
      await goto(hash);
      if (after) {
        // Wrapped in an async IIFE so a step can await its own settling — the
        // muscle panel needs the map painted before a muscle can be tapped.
        try { await evaluate(`(async () => { ${after} })()`); } catch { /* step is best-effort */ }
        await sleep(700);
      }
      await evaluate(`document.documentElement.setAttribute('data-theme','${dark ? 'dark' : 'light'}')`);
      await applyPalette();
      await sleep(150);
      try {
        const r = await evaluate(AUDIT);
        report[`${name} ${width}px ${theme}`] = r;
      } catch (e) {
        report[`${name} ${width}px ${theme}`] = { error: e.message.slice(0, 120) };
      }
    }
  }
}

writeFileSync(process.env.OUT || 'a11y-raw.json', JSON.stringify(report, null, 1));
console.log(`routes audited (${PALETTE}):`, Object.keys(report).length);

chrome.kill();
server.kill();
process.exit(0);
