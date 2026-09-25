// Workout photos (2026-09-25, docs/onboarding-plan.md part C).
//   node tests/photos.test.mjs
//
// The size arithmetic and quality ladder (js/photo.js), what the published
// projection carries (only the size, never the picture), and the store's photo
// API on this device's backend. The permission half is tests/rules.test.mjs.

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const P = await import('../js/photo.js');
const { projectSession, buildProjection } = await import('../js/social.js');
const { store } = await import('../js/store.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

/* A data URL of `bytes` decoded bytes — the real shape a canvas hands back. */
function jpegOf(bytes) {
  const b64 = Buffer.alloc(bytes, 0x5a).toString('base64');
  return 'data:image/jpeg;base64,' + b64;
}

/* ---------- sizes ---------- */
{
  const s = P.fitSize(4032, 3024);
  ok(s.w === 1080 && s.h === 810, `a 12 MP landscape photo fits to 1080×810 (${s.w}×${s.h})`);
  const p = P.fitSize(3024, 4032);
  ok(p.w === 810 && p.h === 1080, `and a portrait one to 810×1080 (${p.w}×${p.h})`);
  const small = P.fitSize(640, 480);
  ok(small.w === 640 && small.h === 480, 'a picture already inside the cap is never enlarged');
  ok(P.fitSize(0, 100) === null, 'a zero-sized image has no size');
  ok(P.dataUrlBytes(jpegOf(150 * 1024)) === 150 * 1024,
    `dataUrlBytes decodes base64 length exactly (${P.dataUrlBytes(jpegOf(150 * 1024))})`);
  ok(P.dataUrlBytes(jpegOf(1001)) === 1001, 'including padded lengths');
  ok(jpegOf(P.PHOTO_MAX_BYTES).length <= P.MAX_PHOTO_CHARS,
    `a photo exactly at the byte cap fits the string cap the rules enforce (${jpegOf(P.PHOTO_MAX_BYTES).length} ≤ ${P.MAX_PHOTO_CHARS})`);
}

/* ---------- validators ---------- */
{
  ok(P.safePhoto(jpegOf(1000)) !== null, 'a JPEG data URL is accepted');
  ok(P.safePhoto('data:image/png;base64,AAAA') === null, 'a PNG is refused — the app only ever writes JPEG');
  ok(P.safePhoto('data:image/svg+xml;base64,PHN2Zz4=') === null, 'an SVG is refused (a document, not a picture)');
  ok(P.safePhoto('https://example.com/a.jpg') === null, 'a remote URL is refused');
  ok(P.safePhoto(jpegOf(160 * 1024)) === null, 'an oversize string is refused');
  ok(P.safePhoto(12) === null, 'a non-string is refused');
  ok(JSON.stringify(P.safePhotoSize({ w: 1080, h: 810 })) === '{"w":1080,"h":810}', 'a real size passes');
  ok(P.safePhotoSize({ w: 1081, h: 10 }) === null, 'a side over 1080 is refused');
  ok(P.safePhotoSize({ w: '1080', h: 810 }) === null, 'a string is not a number');
  ok(P.safePhotoSize({ w: 10.5, h: 810 }) === null, 'a fraction is not a pixel count');
  ok(P.boxRatio({ w: 1080, h: 810 }) === 1080 / 810, 'the box keeps a landscape photo’s own shape');
  ok(P.boxRatio({ w: 810, h: 1080 }) === 0.8, 'a portrait box stops at 4:5 so one photo cannot fill a phone');
  ok(P.boxRatio(null) === 4 / 3, 'no size → a 4:3 box');
}

/* ---------- the quality ladder ---------- */
{
  // A stand-in encoder shaped like a real one: bytes grow with pixel count and
  // with quality. `bpp` is bytes per pixel at quality 1 — ~0.45 is a noisy
  // phone photo, ~0.12 a flat indoor one.
  const encoder = (bpp) => {
    const calls = [];
    const fn = (w, h, q) => { calls.push([w, h, q]); return jpegOf(Math.round(w * h * bpp * q * q)); };
    fn.calls = calls;
    return fn;
  };

  const flat = encoder(0.12);
  const a = await P.compressToFit(flat, 4032, 3024);
  ok(a.quality === P.QUALITY_STEPS[0] && a.w === 1080, `a flat photo keeps the best quality at full size (q${a.quality}, ${a.bytes} B)`);
  ok(flat.calls[0][0] === 1080 && flat.calls[0][1] === 810,
    '🚨 the FIRST encode is already at 1080px — a 12 MP canvas is never encoded whole');

  const noisy = encoder(0.45);
  const b = await P.compressToFit(noisy, 4032, 3024);
  ok(b.bytes <= P.PHOTO_MAX_BYTES, `a noisy photo steps down until it fits (${b.bytes} B ≤ ${P.PHOTO_MAX_BYTES})`);
  ok(b.quality < P.QUALITY_STEPS[0] && b.w === 1080, `by quality first, not by size (q${b.quality}, ${b.w}px)`);
  ok(noisy.calls.every(([, , q], i, arr) => i === 0 || q < arr[i - 1][2]),
    'quality only ever goes down while the size holds');

  const huge = encoder(1.6);
  const c = await P.compressToFit(huge, 4032, 3024);
  ok(c.w < 1080 && c.bytes <= P.PHOTO_MAX_BYTES,
    `a photo too big at every quality shrinks and starts again (${c.w}×${c.h}, ${c.bytes} B)`);

  let threw = null;
  try { await P.compressToFit(encoder(100), 4032, 3024); } catch (err) { threw = err; }
  ok(threw && /small enough/.test(threw.message),
    'an impossible photo is refused with a sentence rather than stored as a postage stamp');
}

/* ---------- the projection carries the SIZE, never the picture ---------- */
{
  const session = {
    id: 's1', date: '2026-09-25', workoutName: 'Push', photo: { w: 1080, h: 810 },
    entries: [{ exerciseId: 'bench', exerciseName: 'Bench', sets: [{ weight: 185, reps: 5 }] }],
  };
  const out = projectSession(session);
  ok(out.photo && out.photo.w === 1080 && out.photo.h === 810, 'a published session says it has a photo, and its shape');
  const doc = buildProjection({ audience: 'friends', viewers: ['a'], sessions: [session], publishedAt: 'x' });
  ok(!JSON.stringify(doc).includes('base64'), '🚨 no picture ever rides in the published document');
  const bad = projectSession({ ...session, photo: { w: 99999, h: 1, url: jpegOf(10) } });
  ok(!('photo' in bad), 'a malformed size is dropped, not published');
  const none = projectSession({ ...session, photo: undefined });
  ok(!('photo' in none), 'a session without a photo publishes no photo key');
}

/* ---------- the store: this device's backend ---------- */
{
  const sid = 's-photo-1';
  const pic = { url: jpegOf(120 * 1024), w: 1080, h: 810 };
  ok(typeof store.savePhoto === 'function' && typeof store.photoFor === 'function'
     && typeof store.deletePhoto === 'function', 'the store has savePhoto / photoFor / deletePhoto');

  await store.saveSession({ id: sid, date: '2026-09-25', workoutName: 'Push', photo: { w: 1080, h: 810 },
    entries: [{ exerciseId: 'x', exerciseName: 'X', sets: [{ weight: 100, reps: 5 }] }] });
  await store.savePhoto(sid, pic);
  const back = await store.photoFor(sid);
  ok(back && back.url === pic.url && back.w === 1080, 'a saved photo reads back');

  const raw = [...mem.values()].join('');
  ok(!raw.includes(pic.url.slice(40, 200)),
    '🚨 the picture is NOT in localStorage — a few dozen would fill it and lose a workout at Finish');
  const row = (await store.getSessions()).find((s) => s.id === sid);
  ok(row && row.photo && !('url' in row.photo), 'the session row holds the size only');

  let refused = 0;
  for (const badPic of [
    { url: 'data:image/png;base64,AAAA', w: 10, h: 10 },
    { url: jpegOf(10), w: 5000, h: 10 },
    { url: jpegOf(200 * 1024), w: 1080, h: 810 },
  ]) {
    try { await store.savePhoto(sid, badPic); } catch (_) { refused++; }
  }
  ok(refused === 3, `a PNG, an oversize side and an oversize file are all refused (${refused}/3)`);
  ok((await store.photoFor(sid)).url === pic.url, 'and a refused save leaves the stored photo alone');

  await store.deleteSession(sid);
  ok((await store.photoFor(sid)) === null, '🚨 deleting the workout deletes its photo');

  await store.savePhoto('s-photo-2', pic);
  await store.deletePhoto('s-photo-2');
  ok((await store.photoFor('s-photo-2')) === null, 'Remove deletes it on its own');
  ok((await store.photoFor('s-photo-3', 'someone-else')) === null,
    'with no cloud, nobody else’s photo exists here — null, not an error');
}

console.log(fails === 0 ? '\nAll photo checks passed.' : `\n${fails} photo check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
