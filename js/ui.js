// Shared UI primitives: DOM builder, icons, sheets, toasts, steppers, formatters.

import { FIELD_META } from './exercises.js';

/* ------------------------------------------------------------------ *
 * DOM
 * ------------------------------------------------------------------ */

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node && k !== 'list' && typeof v !== 'object') node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ------------------------------------------------------------------ *
 * Icons
 * ------------------------------------------------------------------ */

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  dumbbell: 'M4 9v6M20 9v6M7.5 6.5v11M16.5 6.5v11M7.5 12h9',
  calendar: 'M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9.5h16M8.5 3v4M15.5 3v4',
  chart: 'M4 4v16h16M7.5 15.5l4-5 3 3 5-6.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  right: 'M9.5 5.5l6.5 6.5-6.5 6.5',
  left: 'M14.5 5.5L8 12l6.5 6.5',
  x: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6M13.5 10.5v6',
  check: 'M4.5 12.5l5 5L19.5 7',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.2 16.2L21 21',
  up: 'M6 14.5L12 8.5l6 6',
  down: 'M6 9.5l6 6 6-6',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 4.5v5M8 14.5v5',
  play: 'M7.5 5.5v13l11-6.5z',
  edit: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z',
  flag: 'M5 21V4h13l-2.5 4L18 12H5',
  person: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
};

export function icon(name, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', PATHS[name] || PATHS.home);
  if (name === 'play') p.setAttribute('fill', 'currentColor');
  svg.append(p);
  return svg;
}

export function iconBtn(name, label, onClick, cls = 'icon-btn') {
  return el('button', { class: cls, 'aria-label': label, title: label, onClick }, icon(name));
}

export function chevron() {
  return el('span', { class: 'row-chev' }, icon('right'));
}

/* ------------------------------------------------------------------ *
 * Profile button — top-left of every main screen
 * ------------------------------------------------------------------ */

// Returns immediately with a neutral avatar and fills itself in once the
// account state is known, so no view has to await anything to render.
//
// It carries a warning dot whenever the data is NOT backed up — an anonymous
// account, or no cloud at all. That is the one status worth interrupting
// someone about, because it is the only one where they can lose everything.
//
// store.js is imported dynamically rather than at the top: ui.js is otherwise
// pure presentation, and a lazy import keeps that true and rules out any
// import cycle.
export function profileButton() {
  const glyph = el('span', { class: 'avatar-glyph' }, icon('person'));
  const btn = el('a', {
    class: 'avatar-btn at-risk',
    href: '#/account',
    'aria-label': 'Account',
    title: 'Account',
  }, glyph);

  const paint = (state) => {
    const user = state && state.user;
    const secured = Boolean(user && user.secured);
    btn.classList.toggle('secured', secured);
    btn.classList.toggle('at-risk', !secured);

    if (secured && user.email) {
      glyph.replaceChildren(document.createTextNode(user.email.trim()[0].toUpperCase()));
      btn.setAttribute('aria-label', `Account — signed in as ${user.email}`);
      btn.setAttribute('title', user.email);
    } else if (secured) {
      glyph.replaceChildren(icon('person'));
      btn.setAttribute('aria-label', 'Account — signed in');
      btn.setAttribute('title', 'Account');
    } else {
      glyph.replaceChildren(icon('person'));
      btn.setAttribute('aria-label', 'Account — your data is not backed up');
      btn.setAttribute('title', 'Your data is not backed up');
    }
  };

  import('./store.js')
    .then(async ({ auth }) => {
      paint(await auth.state());

      // A new button is built on every navigation, so the subscription has to
      // die with the node it belongs to — otherwise listeners accumulate for
      // the life of the session, each pinning a detached element.
      // `wasMounted` guards the gap between creating the button and appending
      // it, so a change arriving in that window doesn't cancel it early.
      let wasMounted = false;
      let stop = null;
      stop = auth.onChange(async () => {
        if (btn.isConnected) wasMounted = true;
        else if (wasMounted) { if (stop) stop(); return; }
        paint(await auth.state());
      });
    })
    .catch((err) => console.error('Could not read account state', err));

  return btn;
}

/* ------------------------------------------------------------------ *
 * Toast
 * ------------------------------------------------------------------ */

let toastTimer = null;
export function toast(message) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', { class: 'toast', role: 'status', text: message });
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2400);
}

/* ------------------------------------------------------------------ *
 * Bottom sheet
 * ------------------------------------------------------------------ */

export function openSheet({ title, body, footer, onClose }) {
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    el('div', { class: 'sheet-head' },
      el('h2', { text: title }),
      iconBtn('x', 'Close', close),
    ),
    el('div', { class: 'sheet-body' }, body),
    footer ? el('div', { class: 'sheet-foot' }, footer) : null,
  );

  const backdrop = el('div', {
    class: 'sheet-backdrop',
    onClick: (e) => { if (e.target === backdrop) close(); },
  }, sheet);

  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  return { close, sheet };
}

export function confirmSheet({ title, message, confirmLabel = 'Delete', danger = true, onConfirm }) {
  const { close } = openSheet({
    title,
    body: el('p', { text: message, style: 'margin:0;color:var(--ink-soft);line-height:1.5' }),
    footer: el('div', { class: 'btn-row' },
      el('button', { class: 'btn ghost', text: 'Cancel', onClick: () => close() }),
      el('button', {
        class: 'btn ' + (danger ? 'danger' : 'primary'),
        text: confirmLabel,
        onClick: () => { close(); onConfirm(); },
      }),
    ),
  });
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

export function parseTime(str) {
  const t = String(str).trim();
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    return (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
  }
  return Math.max(0, Math.round(parseFloat(t) || 0));
}

export function fmtField(field, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const m = FIELD_META[field];
  if (field === 'time') return fmtTime(value);
  if (field === 'distance') return `${Number(value).toFixed(2)} ${m.unit}`;
  if (field === 'weight') return `${trimNum(value)} ${m.unit}`;
  return `${trimNum(value)}`;
}

export function trimNum(n) {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

export function fmtSet(set, fields, loadType) {
  const parts = [];
  if (fields.includes('weight') && set.weight != null) {
    parts.push(`${trimNum(set.weight)} lbs${loadType === 'per_side' ? '/side' : ''}`);
  }
  if (fields.includes('reps') && set.reps != null) parts.push(`× ${trimNum(set.reps)}`);
  if (fields.includes('time') && set.time != null) parts.push(fmtTime(set.time));
  if (fields.includes('distance') && set.distance != null) parts.push(`${Number(set.distance).toFixed(2)} mi`);
  return parts.join('  ') || '—';
}

export function fmtDateLong(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export function fmtDateShort(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function relativeDay(iso) {
  const today = new Date();
  const [y, m, d] = iso.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - then) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return fmtDateShort(iso);
}

/* ------------------------------------------------------------------ *
 * Stepper — the primary in-gym control.
 * Big targets, tap-and-hold to repeat, direct typing allowed.
 * ------------------------------------------------------------------ */

export function stepper({ field, value, onChange, suffix }) {
  const meta = FIELD_META[field];
  let current = value == null ? 0 : Number(value);

  const input = el('input', {
    class: 'step-value mono',
    type: field === 'time' ? 'text' : 'number',
    inputmode: field === 'distance' ? 'decimal' : 'numeric',
    value: display(current),
    'aria-label': meta.label,
  });

  function display(v) {
    if (field === 'time') return fmtTime(v);
    if (field === 'distance') return Number(v).toFixed(2);
    return trimNum(v);
  }

  function set(v, silent) {
    current = Math.max(meta.min, Math.round(v * 100) / 100);
    input.value = display(current);
    if (!silent) onChange(current);
  }

  function bump(dir) {
    set(current + dir * meta.step);
    if (navigator.vibrate) navigator.vibrate(8);
  }

  // press-and-hold to repeat
  function holdable(btn, dir) {
    let to = null, iv = null;
    const start = (e) => {
      e.preventDefault();
      bump(dir);
      to = setTimeout(() => { iv = setInterval(() => bump(dir), 90); }, 420);
    };
    const stop = () => { clearTimeout(to); clearInterval(iv); to = iv = null; };
    btn.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
    return btn;
  }

  input.addEventListener('focus', () => { if (field === 'time') input.value = current; input.select(); });
  input.addEventListener('blur', () => {
    const raw = field === 'time' ? parseTime(input.value) : parseFloat(input.value);
    set(Number.isNaN(raw) ? current : raw);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });

  const minus = holdable(el('button', { class: 'step-btn', type: 'button', 'aria-label': `Decrease ${meta.label}` }, icon('minus')), -1);
  const plus = holdable(el('button', { class: 'step-btn', type: 'button', 'aria-label': `Increase ${meta.label}` }, icon('plus')), 1);

  const node = el('div', { class: 'stepper' },
    el('div', { class: 'stepper-label' },
      meta.label,
      suffix ? el('em', { class: 'stepper-suffix', text: suffix }) : null,
    ),
    el('div', { class: 'stepper-controls' }, minus, input, plus),
    el('div', { class: 'step-unit', text: stepHint(field, meta) }),
  );

  return { node, get: () => current, set: (v) => set(v, true) };
}

function stepHint(field, meta) {
  if (field === 'time') return `${meta.step} sec steps`;
  if (field === 'weight') return `${meta.step} lb steps`;
  if (field === 'distance') return `${meta.step} mi steps`;
  return `1 rep steps`;
}

/* ------------------------------------------------------------------ *
 * Mini stepper — compact inline counter, used for planned set counts
 * ------------------------------------------------------------------ */

export function miniStepper({ value, min = 1, max = 20, onChange, label = 'Sets' }) {
  let current = value;
  const out = el('span', { class: 'mini-value mono', text: String(current) });

  const step = (dir) => {
    const next = Math.min(max, Math.max(min, current + dir));
    if (next === current) return;
    current = next;
    out.textContent = String(current);
    onChange(current);
    if (navigator.vibrate) navigator.vibrate(6);
  };

  return el('div', { class: 'mini-stepper', role: 'group', 'aria-label': label },
    el('button', { type: 'button', class: 'mini-btn', 'aria-label': `One fewer ${label}`, onClick: () => step(-1) }, icon('minus')),
    out,
    el('button', { type: 'button', class: 'mini-btn', 'aria-label': `One more ${label}`, onClick: () => step(1) }, icon('plus')),
  );
}

/* ------------------------------------------------------------------ *
 * Load-type badge — says whether a weight is per side or the whole load
 * ------------------------------------------------------------------ */

export function loadBadge(loadType) {
  if (!loadType) return null;
  return el('span', {
    class: 'load-badge' + (loadType === 'per_side' ? ' per-side' : ''),
    text: loadType === 'per_side' ? 'PER SIDE' : 'TOTAL',
  });
}

/* ------------------------------------------------------------------ *
 * Empty state
 * ------------------------------------------------------------------ */

export function emptyState(title, message, action) {
  return el('div', { class: 'empty' },
    el('div', { class: 'empty-title', text: title }),
    el('p', { text: message }),
    action || null,
  );
}

/* ------------------------------------------------------------------ *
 * Screen shell — topbar + body, shared by every view
 * ------------------------------------------------------------------ */

// The page itself never scrolls. A screen is a fixed header, an optional fixed
// region under it, exactly one scrolling region, and an optional fixed footer.
// Anything that overflows scrolls inside `scroll` — never the window.
// `title` may be a string or a DOM node. Passing a node lets a screen put its
// primary control in the header instead of a redundant heading, which buys back
// a whole row for the content.
export function screenShell({ title, sub, back, actions, top, scroll, bottom, body, noNav, profile }) {
  const heading = title instanceof Node
    ? el('div', { class: 'topbar-slot' }, title)
    : el('div', { style: 'flex:1;min-width:0' },
        el('h1', { text: title }),
        sub ? el('div', { class: 'topbar-sub', text: sub }) : null,
      );

  return el('div', { class: 'screen' + (noNav ? ' no-nav' : '') },
    el('header', { class: 'topbar' },
      // Left slot: back where there is somewhere to go back to, otherwise the
      // profile button. Never both — two things competing for the top-left
      // corner is how you get people tapping the wrong one.
      back ? iconBtn('left', 'Back', back) : (profile ? profileButton() : null),
      heading,
      ...(actions || []),
    ),
    top ? el('div', { class: 'pane-top' }, top) : null,
    el('div', { class: 'pane-scroll' }, scroll || body),
    bottom ? el('div', { class: 'pane-bottom' }, bottom) : null,
  );
}
