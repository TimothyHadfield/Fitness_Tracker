// Throwaway: render each candidate icon to PNG at real sizes, and build one
// contact sheet showing them masked the way iOS masks them, at the size a home
// screen actually shows them.
import { spawn } from 'node:child_process';
import { writeFileSync, readdirSync, readFileSync } from 'node:fs';

const DIR = 'C:/Users/timha/AppData/Local/Temp/logo';
const PORT = '8801';
const CDP = 9421;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const svgs = readdirSync(DIR).filter((f) => f.endsWith('.svg')).sort();

// A page that lays every candidate out: big, home-screen size, and tiny —
// because the only size that matters is the one on a phone, and a logo that
// only works at 512 is a logo nobody will ever see working.
const cell = (f) => {
  const svg = readFileSync(`${DIR}/${f}`, 'utf8');
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const label = f.replace(/^[a-z]-/, '').replace('.svg', '');
  return `<div class="cell">
    <div class="big"><img src="${uri}"></div>
    <div class="row">
      <div><img class="ios" src="${uri}"><div class="cap">home screen</div></div>
      <div><img class="tiny" src="${uri}"><div class="cap">tiny</div></div>
    </div>
    <div class="name">${f[0].toUpperCase()} &middot; ${label}</div>
  </div>`;
};

const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin:0; padding:28px; background:#12161a; font-family:system-ui,sans-serif; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:26px; }
  .cell { background:#1b2026; border-radius:14px; padding:16px; text-align:center; }
  .big img { width:150px; height:150px; border-radius:34px; display:block; margin:0 auto; }
  .row { display:flex; gap:18px; justify-content:center; align-items:flex-end; margin-top:14px; }
  .ios { width:60px; height:60px; border-radius:14px; display:block; }
  .tiny { width:32px; height:32px; border-radius:8px; display:block; }
  .cap { color:#7d8891; font-size:10px; margin-top:5px; }
  .name { color:#e7ebee; font-size:13px; font-weight:600; margin-top:14px; }
</style><div class="grid">${svgs.map(cell).join('')}</div>`;

writeFileSync(`${DIR}/sheet.html`, html);

let ws, id = 0;
const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => {
  const msg = { id: ++id, method: m, params: p };
  pending.set(msg.id, { res, rej });
  ws.send(JSON.stringify(msg));
});
async function connect() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP}/json/version`); if (r.ok) break; } catch {}
    await sleep(250);
  }
  const t = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
  ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl);
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
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
};

const server = spawn('python', ['-m', 'http.server', PORT], { cwd: DIR, stdio: 'ignore' });
await sleep(1200);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP}`,
  `--user-data-dir=C:/Users/timha/AppData/Local/Temp/cdp-icons-${process.pid}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--force-device-scale-factor=2'], { stdio: 'ignore' });
await connect();
await send('Page.enable'); await send('Runtime.enable');

// ---- the contact sheet ----
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 900, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/sheet.html` });
await sleep(1400);
const h = await evaluate('document.body.scrollHeight');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: Math.ceil(h) + 20, deviceScaleFactor: 2, mobile: false });
await sleep(500);
let s = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('C:/Users/timha/AppData/Local/Temp/logo-options.png', Buffer.from(s.data, 'base64'));
console.log('contact sheet written');

// ---- each one as a real PNG at 512 and 180, which is what ships ----
for (const f of svgs) {
  const svg = readFileSync(`${DIR}/${f}`, 'utf8');
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  for (const size of [512, 180]) {
    await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(150);
    await evaluate(`document.documentElement.innerHTML =
      '<body style="margin:0"><img style="width:${size}px;height:${size}px;display:block" src="${uri}"></body>'`);
    await sleep(250);
    s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${DIR}/${f.replace('.svg', '')}-${size}.png`, Buffer.from(s.data, 'base64'));
  }
}
console.log('pngs written');

chrome.kill(); server.kill(); process.exit(0);
