// figureNote() — a ? body that carries somebody else's chart.
//
//   npm install jsdom          (anywhere; it is a TEST-only dependency)
//   node tests/figure-note.test.mjs
//
// Same harness as tests/render.test.mjs: a real DOM, the real module, no build
// step. What is pinned here is not the look of the thing — jsdom does no layout
// and this file asserts nothing it cannot see — but the two promises the helper
// makes and the one it must break loudly:
//
//   · a figure without a credit THROWS. These are other people's figures shown
//     under CC BY, and attribution is the entire condition we may show them
//     under. Rendering one anyway would be a licence breach that looks fine.
//   · the node really contains the image and the credit words.
//   · the explanation survives the figure — a reader whose image never loads
//     still gets the whole answer, which is Rule 9 rather than politeness.
//   · every figure the app ships is a file that exists, is a `cc by` paper in
//     the research index, and is credited to that paper. A licence is not a
//     thing to check once.
import { JSDOM } from 'jsdom';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/#/goals',
  pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.Node = window.Node;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); c ? pass++ : fail++; };
const settle = () => new Promise((r) => setTimeout(r, 30));
const root = new URL('../', import.meta.url);
const { figureNote, helpDot } = await import(new URL('js/ui.js', root).href);

const FIG = {
  src: 'img/figures/fphys-09-00744-g002.jpg',
  alt: 'Strength change after eleven weeks of training once or three times a week.',
  credit: 'Ochi E, Maruo M, Tsuchiya Y, Ishii N, Miura K, Sasaki K. 2018. Higher Training '
    + 'Frequency Is Important for Gaining Muscular Strength Under Volume-Matched Training. '
    + 'Frontiers in Physiology. doi:10.3389/fphys.2018.00744',
  licence: 'CC BY 4.0',
};

/* ====== the credit is a condition, not a nicety ====== */
{
  const threw = (fig) => {
    try { figureNote('Because the numbers move.', fig); return false; } catch { return true; }
  };

  ok(threw({ src: FIG.src, alt: FIG.alt }),
     '🚨 no credit, no figure — it THROWS rather than rendering somebody else’s chart stripped of '
     + 'the attribution that is the whole condition we may show it under');
  ok(threw({ src: FIG.src, credit: '' }), 'an empty credit is no credit');
  ok(threw({ src: FIG.src, credit: '   ' }), 'and neither is whitespace');
  ok(threw({ credit: FIG.credit }), 'a figure with no src is refused too — there is nothing to show');
  ok(threw(undefined), 'and so is a call with no figure at all');
}

/* ====== what it returns ====== */
{
  const node = figureNote('Sessions are the clearest of the four.', FIG);

  ok(node instanceof window.Node, 'it returns a DOM node, which is what helpDot() takes as a body');

  const img = node.querySelector('img');
  ok(Boolean(img), 'the node contains the image');
  ok(img.getAttribute('src') === FIG.src, 'pointing at the figure it was given');
  ok(img.getAttribute('alt') === FIG.alt,
     '⚠️ with real alt text — a chart with no alt is a blank to every screen reader, and this one '
     + 'is carrying the evidence for a number');
  ok(/Ochi E/.test(node.textContent) && /doi:10\.3389/.test(node.textContent),
     'and the credit line is IN the node, as text, beside the figure it credits');
  ok(/CC BY 4\.0/.test(node.textContent), 'naming the licence, which CC BY requires by name');
  ok(/Sessions are the clearest/.test(node.textContent),
     '⚠️ and the explanation is still there — the words are the answer and the picture is the '
     + 'evidence, never the other way round');

  // The order is the argument: words, then the chart, then who made it.
  const kids = [...node.children];
  const firstFigure = kids.findIndex((k) => k.tagName === 'FIGURE');
  ok(firstFigure > 0, 'the text comes before the figure');
  ok(node.querySelector('figure figcaption'),
     'and the credit is the figure’s own caption rather than a loose line that could be moved away '
     + 'from it');

  // Text may also arrive as several paragraphs.
  const many = figureNote(['One.', 'Two.'], FIG);
  ok(many.querySelectorAll('p').length === 2, 'a list of paragraphs renders as paragraphs');
}

/* ====== it works as a ? body, which is the only reason it exists ====== */
{
  const node = figureNote('Sessions are the clearest of the four.', FIG);
  const dot = helpDot(node, { label: 'Why only some of these grow with the goal' });
  document.getElementById('app').replaceChildren(dot);
  await settle();

  ok(!document.querySelector('.help-pop'), 'nothing is open to begin with');
  dot.click();
  await settle();

  const pop = document.querySelector('.help-pop');
  ok(Boolean(pop), 'tapping the ? opens the box');
  ok(Boolean(pop.querySelector('img.help-figure')), 'with the figure inside it');
  ok(/Ochi E/.test(pop.textContent), 'and the credit travels with it into the popover');
  ok(pop.querySelector('img').getAttribute('loading') !== 'lazy',
     '⚠️ never lazy — the box is measured and clamped to the screen the moment it opens, so an '
     + 'image that arrives afterwards is a box that was measured without it');

  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();
  ok(!document.querySelector('.help-pop'), 'and Escape still closes it');
  document.getElementById('app').replaceChildren();
}

/* ====== 🚨 every shipped figure is a file, and a CC BY one ======
 *
 * The licence rule is absolute and it is not a thing anybody remembers to
 * re-check by hand: -NC is out because this app may one day carry donations or
 * ads, and -ND is out because a phone crops. So the test reads the same index
 * the figures were taken from and asserts it, for every figure the app ships.
 *
 * ⚠️ The research library is READ here and never written. If it is not present
 * (a checkout of the app alone), the licence check is reported as skipped rather
 * than passing quietly — a licence assertion that silently does nothing is worse
 * than no assertion.
 */
{
  const uiSrc = readFileSync(fileURLToPath(new URL('js/ui.js', root)), 'utf8');
  ok(/export function figureNote/.test(uiSrc), 'figureNote is exported from js/ui.js');

  const used = new Set();
  for (const f of ['js/views-goals.js', 'js/views-muscles.js', 'js/views-data.js',
    'js/views-workouts.js', 'js/views-social.js', 'js/views-account.js', 'js/views-profile.js']) {
    const p = fileURLToPath(new URL(f, root));
    if (!existsSync(p)) continue;
    for (const m of readFileSync(p, 'utf8').matchAll(/img\/figures\/([\w.-]+)/g)) used.add(m[1]);
  }
  ok(used.size > 0, `the app ships ${used.size} figure(s) — otherwise this block proves nothing`);

  for (const file of used) {
    ok(existsSync(fileURLToPath(new URL('img/figures/' + file, root))),
       `img/figures/${file} is actually in the repo`);
  }

  const indexPath = fileURLToPath(
    new URL('Fitness_Research/Jeff Nippard videos/figures/index.json', root));
  if (!existsSync(indexPath)) {
    console.log('SKIP  the research index is not in this checkout — licences unverified here');
  } else {
    const articles = JSON.parse(readFileSync(indexPath, 'utf8')).articles;
    for (const file of used) {
      const owner = Object.entries(articles).find(([, a]) =>
        (a.downloaded || []).some((d) => d.file === file));
      ok(Boolean(owner), `${file} is traceable to a paper in the research index`);
      if (!owner) continue;
      const [pmcid, article] = owner;
      ok(String(article.licence).toLowerCase() === 'cc by',
         `🚨 ${file} (${pmcid}) is licensed "${article.licence}" — and the rule is that it is `
         + 'EXACTLY cc by. -nc forbids the commercial use this app may one day make of itself, and '
         + '-nd forbids the cropping a phone screen does');
      const surname = String(article.authors || '').split(/[\s,]+/)[0];
      const inApp = readFileSync(fileURLToPath(new URL('js/views-goals.js', root)), 'utf8');
      ok(surname.length > 1 && inApp.includes(surname) && inApp.includes(article.doi),
         `and the credit beside it names ${surname} and doi:${article.doi} — the attribution is `
         + 'the condition, so it is asserted rather than assumed');
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
