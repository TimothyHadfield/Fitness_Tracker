// Account screen.
//
// Model: anonymous first, upgrade later. Someone can log a whole workout before
// ever seeing this screen. What they get here is the ability to make that data
// survive losing the phone.
//
// The one thing this screen must never do is imply data is safe when it isn't.
// An anonymous account lives in one browser and nothing recovers it — clearing
// site data destroys it permanently. That is stated plainly rather than buried.

import { store, auth, probeOffline, demo, todayISO, social, feedback } from './store.js';
import {
  el, screenShell, toast, confirmSheet, emptyState, openSheet, icon, chevron, refreshRoute,
  setChildren, fmtDateShort, helpDot,
} from './ui.js';
import { cloudFullWarning } from './views-data.js';
/* ⚠️ THE SHEETS ARE IMPORTED, NEVER RE-DRAWN HERE. Both of these are the same
 * control the Friends screen offers, and a second copy of a visibility picker is
 * a second place for the words about who can see somebody's training to drift.
 * `visibilitySheet()` in particular carries the list Rule 9 says must stay in
 * the open; reimplementing it here would be reimplementing that decision. */
import { visibilitySheet, renameSheet } from './views-social.js';
import {
  PUBLIC_ACCOUNT, VISIBILITY_LABEL, VISIBILITY_DETAIL, normalizeVisibility,
} from './social.js';
import * as units from './units.js';
import * as crop from './image-crop.js';

const go = (hash) => { location.hash = hash; };

/* ------------------------------------------------------------------ *
 * The demo account
 *
 * Tim, 2026-08-19: he cannot judge screens he has no data for, and recording a
 * year of training by hand to find out is not a reasonable ask.
 *
 * It sits on the Account screen and on EVERY variant of it — signed in,
 * anonymous, offline, and cloud-not-configured. Looking around is not a thing
 * you should have to have an account to do, and the offline branch is the one
 * where somebody most wants something to look at.
 * ------------------------------------------------------------------ */

/* 🚨 THE CARD TIM POINTED AT — 2026-09-08: *"all details like the 'view demo
 * account' descriptions should be held in a question mark that pops up when you
 * click on it to learn more, don't display it on the main screen."*
 *
 * ⚠️ NOTHING WAS DELETED, and the two facts a person needs BEFORE tapping are
 * still stated before tapping — they are one tap away instead of two paragraphs
 * deep. That is Design Rule 9 exactly: the button says WHAT it does, the ? says
 * what is in there and why it is safe. */
function demoCard() {
  if (!demo.available()) return null;

  return el('div', { class: 'card' },
    el('div', { class: 'help-line' },
      el('div', { class: 'section-label', text: 'Just looking around' }),
      helpDot(el('div', {},
        el('p', {}, el('b', { text: 'A made-up year. ' }),
          'Two programmes, a few hundred sessions, benchmarks, body weight and a goal in progress, '
          + 'so every screen has something in it.'),
        el('p', {}, el('b', { text: 'Nothing is saved. ' }),
          'It lives in this tab only, and starts fresh every time. Change anything you like.'),
        el('p', {}, el('b', { text: 'Your own data is untouched ' }),
          'and waiting for you when you come back.'),
      ), { label: 'What the demo account is', title: 'The demo account' })),
    el('button', {
      class: 'btn primary block', text: 'View demo account',
      onClick: () => demo.enter(),
    }),
  );
}

/** What the Account screen becomes while the demo is on. */
function demoScreen() {
  return screenShell({
    title: 'Account',
    back: () => go('#/home'),
    scroll: [
      /* ⚠️ THREE PARAGRAPHS BECAME A LINE AND A "?" — 2026-09-08. The demo bar
       * `app.js` prepends to EVERY screen already reads *"Demo account. Made-up
       * data — change anything you like, nothing is saved"*, so this card was
       * the third statement of the same sentence on the same screen. What is
       * behind the ? is the part the bar cannot fit: that a reload starts over,
       * and that Social is off — named rather than left to be discovered by
       * somebody tapping it. */
      el('div', { class: 'card' },
        el('div', { class: 'help-line' },
          el('div', { class: 'section-label', text: 'You are in the demo account' }),
          helpDot(el('div', {},
            el('p', {}, 'None of this is real — it is a generated year of training, so that the '
              + 'systems, the calendar, the graphs, the muscle map and the goal all have '
              + 'something in them.'),
            el('p', {}, 'Nothing here is saved anywhere. Edit a workout, delete a system, log a '
              + 'session — it lives in this tab and nowhere else, and reloading the page '
              + 'starts it over from the same beginning.'),
            el('p', {}, 'Social is switched off while you are in here, because publishing '
              + 'invented workouts to real friends would be worse than not being able to try it.'),
          ), { label: 'What the demo account is', title: 'The demo account' })),
      ),
      el('button', {
        class: 'btn primary block', text: 'Leave the demo',
        onClick: () => demo.exit(),
      }),
      el('div', { class: 'field-help', style: 'text-align:center' },
        'Your own account and everything in it is exactly where you left it.'),
    ],
  });
}

// Rebuild the screen you are on. ⚠️ It used to bounce through `#/blank`, which
// pushed two history entries and therefore broke the back arrow the day back
// started meaning "the previous screen" (2026-09-02). `refreshRoute()` renders
// in place and pushes nothing.
function refresh() {
  refreshRoute();
}

// Firebase reports its own errors; anything else gets a generic line.
async function run(button, label, fn) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    await fn();
  } catch (err) {
    const { authErrorMessage } = await import('./firebase-backend.js');
    toast(authErrorMessage(err));
    button.disabled = false;
    button.textContent = original;
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * The person, not just the login — Tim, 2026-08-26: "when you click on the
 * account button it should show all account and profile details, not just
 * backup or whatever." The photo, the profile, and the data controls that
 * used to live in Settings now travel with the account, whatever state the
 * account is in.
 * ------------------------------------------------------------------ */

/* The size the finished avatar is stored at. Everything that displays a face
 * paints it at 64px or less, so 256 covers a 3x phone screen with room over. */
const AVATAR_PX = 256;

/* ⚠️ THE RE-EDITABLE COPY, and why it is worth its bytes.
 *
 * Tim, 2026-08-27: "make a feature where you can edit the profile picture
 * though (resize, move the center circle)." Editing the STORED avatar would be
 * editing a 256px square that has already had everything outside the circle
 * thrown away — you could zoom further in and never back out, and the picture
 * would soften every time it was touched. So the source is kept, once, at a
 * size chosen to make re-cropping lossless in practice: 768 is three times the
 * output, which is exactly the module's maximum zoom, so even at the tightest
 * crop there is no upscaling.
 *
 * ⚠️ It is NOT free and the budget is real — the settings document shares a
 * 1 MiB ceiling with everything else in it and cloudUsage() charges every byte.
 * What bounds it is the 768px cap and the 0.78 quality, not any one
 * measurement: a synthetic test image came out at 9 KB, and a real photograph
 * with detail in it will be some tens of KB. Either way it is a small fraction
 * of the document, and it is re-encoded ONCE on pick rather than on every edit.
 * Missing is fine: a photo saved before this shipped has no source, and Edit
 * falls back to the avatar, which still lets it be recentred within itself.
 */
const AVATAR_SOURCE_PX = 768;

/**
 * The profile photo. Stored as a small data URL in settings (`avatar`):
 * resized to 256px and JPEG-compressed CLIENT-SIDE before it is stored, so a
 * 12 MB camera photo becomes ~4 KB — the settings document has a 1 MiB
 * ceiling shared with everything else, and cloudUsage() charges every byte.
 *
 * ⚠️ IT IS PUBLISHED TO FRIENDS SINCE 2026-08-31, WHICH REVERSES WHAT THIS
 * COMMENT SAID. It read: *"Local-only for now: the avatar is NOT published into
 * the social projection, so friends do not see it — publishing a face is a
 * widening that gets its own decision, not a side effect of this feature."*
 * That was right, and Tim has now made the decision — he reported friends
 * seeing "the default blank humanoid" as a bug. It rides beside the name in
 * every tier of the projection (js/social.js, the profile-photo header) and
 * reaches exactly the people who could already read that document.
 */
function avatarCard(settings, user) {
  const hasPhoto = typeof settings.avatar === 'string' && settings.avatar.startsWith('data:image/');
  const face = el('span', { class: 'avatar-face' },
    hasPhoto ? el('img', { src: settings.avatar, alt: '' }) : icon('person', 30));

  // Save all three together: the face everything paints, the source it was cut
  // from, and where the circle was. Written in ONE saveSettings so a re-edit
  // can never leave the crop pointing at a different photo than the source.
  async function keep(result) {
    await store.saveSettings({
      avatar: result.dataUrl,
      avatarSource: result.source,
      avatarCrop: result.crop,
    });
    toast('Photo saved');
    shareFace();
    refresh();
  }

  /**
   * Push the change out to friends.
   *
   * ⚠️ THE PHOTO IS INSIDE EVERY PROJECTION SINCE 2026-08-31, so changing it has
   * to rewrite them — exactly the reason `social.setName` republishes, and the
   * failure mode is the one Tim reported about Autumn's muscle map: a published
   * copy that froze at its owner's last social action while the screen said
   * something else. Fire-and-forget by design — the photo is saved either way,
   * and a person with no account, no network or the demo has nothing to publish.
   * A workout finished later would carry it anyway; this is what makes it
   * immediate.
   */
  function shareFace() {
    // ⚠️ NO `if (social.available)` GUARD, and that is not laziness: `available`
    // is a field of what `social.state()` RESOLVES TO, not a property of the
    // module — `social.available` is `undefined` for everybody, so a guard on it
    // would have quietly meant this never ran. (The same mistake was sitting in
    // views-session.js's people sheet and is fixed there too.) republish()
    // refuses on its own for the demo, for local mode and with no cloud, which
    // is the check that actually knows the answer.
    social.publish().catch(() => {});
  }

  const fileInput = el('input', {
    type: 'file', accept: 'image/*', style: 'display:none',
    onChange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        // ⚠️ The photo is never stored straight off the camera roll any more.
        // A phone photo is a person somewhere in a rectangle, and the old
        // centre-crop cut a square out of the middle of it and hoped — which is
        // how you get an avatar of somebody's shoulder.
        const result = await openAvatarCropper({ file }, AVATAR_PX);
        if (!result) return;                       // cancelled — nothing to say
        await keep(result);
      } catch (err) {
        toast((err && err.message) || 'That image could not be read.');
      }
    },
  });

  async function editExisting() {
    // The source if there is one, the avatar itself if this photo predates it.
    const src = typeof settings.avatarSource === 'string'
      && settings.avatarSource.startsWith('data:image/')
      ? settings.avatarSource : settings.avatar;
    try {
      const result = await openAvatarCropper({
        src,
        // ⚠️ Reopen where they left it, not at the default. Somebody nudging a
        // face two pixels left should not have to find it again first — and a
        // crop restored onto the same source is exactly the picture they saved.
        crop: settings.avatarSource ? settings.avatarCrop : null,
      }, AVATAR_PX);
      if (!result) return;
      await keep(result);
    } catch (err) {
      toast((err && err.message) || 'That image could not be read.');
    }
  }

  const name = (user && user.email) || settings.displayName || '';
  return el('div', { class: 'card avatar-card' },
    face,
    el('div', { class: 'avatar-main' },
      name ? el('div', { class: 'row-title', text: name }) : null,
      el('div', { class: 'avatar-actions' },
        // ⚠️ Edit is FIRST and Change is the secondary one once a photo exists.
        // Repositioning the photo you already chose is the common errand; going
        // back to the camera roll is the rare one.
        hasPhoto ? el('button', {
          class: 'btn small', text: 'Edit', onClick: editExisting,
        }) : null,
        el('button', {
          class: hasPhoto ? 'btn small ghost' : 'btn small',
          text: hasPhoto ? 'Change photo' : 'Add a photo',
          onClick: () => fileInput.click(),
        }),
        hasPhoto ? el('button', {
          class: 'btn small ghost', text: 'Remove',
          onClick: async () => {
            // Clear all three, or a later "Edit" reopens a source with no face
            // in front of it.
            await store.saveSettings({ avatar: '', avatarSource: '', avatarCrop: null });
            toast('Photo removed');
            // ⚠️ REMOVING REPUBLISHES TOO, and this is the half that matters:
            // taking a picture down has to take it down from where other people
            // are looking at it, or "Remove" is a lie about somebody's face.
            shareFace();
            refresh();
          },
        }) : null,
      ),
      /* ⚠️ THE SENTENCE CHANGED WITH THE BEHAVIOUR, 2026-08-31. It read *"Only
       * on this account — friends do not see it"*, which was true and is now
       * false, and a stale reassurance about who can see somebody's face is the
       * worst kind of wrong text this app could carry. Friends means the people
       * on your friends list and nobody else: the photo goes into the same
       * published document they already read, under the same rule.
       *
       * 🚨 AND IT DOES NOT GO BEHIND A "?" — 2026-09-08, when the rest of this
       * screen did. Who can see your face is WHAT, not WHY, and Rule 9 keeps
       * WHAT on the screen: the visibility sheet was left in the open for the
       * same reason. Only the "Edit to move or resize" half went, and it went
       * to nothing rather than into a popover — there is an Edit button eight
       * pixels above it saying so. */
      el('div', { class: 'field-help', text:
        'Shown on your account button, and to the friends you are connected to.' }),
    ),
    fileInput,
  );
}

/**
 * A File or a stored data URL → an <img> that has finished decoding, plus the
 * data URL the editor should keep as the re-editable source.
 *
 * A picked file is shrunk to AVATAR_SOURCE_PX first; a stored source is already
 * that size and is used as it stands, so re-editing the same photo five times
 * re-encodes it once rather than five times.
 */
function loadImage({ file, src }) {
  return new Promise((resolve, reject) => {
    const url = file ? URL.createObjectURL(file) : src;
    const img = new Image();
    const done = () => { if (file) URL.revokeObjectURL(url); };
    const fail = () => { done(); reject(new Error('That image could not be read.')); };
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return fail();
      if (!file) return resolve({ img, source: src, release: () => {} });
      // Shrink once, here, and hand the editor the SAME image it will later cut
      // from — so what the circle framed is what the source holds.
      let source;
      try { source = downscale(img, AVATAR_SOURCE_PX); }
      catch (err) { done(); return reject(err); }
      const small = new Image();
      small.onload = () => { done(); resolve({ img: small, source, release: () => {} }); };
      small.onerror = fail;
      small.src = source;
    };
    img.onerror = fail;
    // ⚠️ An <img>, deliberately, NOT createImageBitmap: browsers apply EXIF
    // orientation to an <img> and not to a bitmap, so a photo taken sideways
    // would preview upright and save on its side. Preview and canvas read the
    // same element, so they cannot disagree about which way up it is.
    img.src = url;
  });
}

/**
 * Whole image → a data URL no bigger than `cap` on its long edge. Aspect ratio
 * is kept: this is a resize, not a crop, because the crop is the user's job.
 * An image already inside the cap is re-encoded rather than passed through,
 * which is what turns a 12 MB camera JPEG into tens of kilobytes.
 */
function downscale(img, cap) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = Math.min(1, cap / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('That image could not be read.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

/**
 * The crop editor. Resolves with a data URL, or with null if it was cancelled.
 *
 * ⚠️ WHAT THE CIRCLE COVERS IS WHAT GETS SAVED — the preview is not an
 * approximation of the result, it is the same rectangle drawn twice. The stage
 * IS the crop square and the circle is inscribed in it, so `crop.layout()`
 * positions the <img> and `crop.cropRect()` cuts it, both from one state.
 */
function openAvatarCropper(input, size) {
  return new Promise((resolve, reject) => {
    loadImage(input).then(({ img, source, release }) => {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      // ⚠️ A saved crop is restored only after being CLAMPED against this
      // image's real dimensions. A stored number could belong to a different
      // photo (settings restored from a backup, an interrupted save), and the
      // module's own clamp turns that from a broken editor into a sane default.
      const saved = input && input.crop;
      const start = saved && Number.isFinite(saved.cx) && Number.isFinite(saved.cy)
        ? crop.zoomTo(iw, ih, saved.zoom, saved.cx, saved.cy)
        : crop.initialCrop(iw, ih);
      let { zoom, cx, cy } = start;
      let frame = 0;                                // stage side, measured

      const photo = el('img', { class: 'crop-img', src: img.src, alt: '' });
      const stage = el('div', { class: 'crop-stage' },
        photo,
        el('div', { class: 'crop-hole' }),
      );

      const zoomable = crop.canZoom(iw, ih);
      const slider = el('input', {
        type: 'range', min: '0', max: '1', step: '0.001', value: String(zoom),
        class: 'crop-zoom', 'aria-label': 'Zoom',
        disabled: !zoomable || undefined,
        onInput: (e) => {
          ({ zoom, cx, cy } = crop.zoomTo(iw, ih, parseFloat(e.target.value), cx, cy));
          paint();
        },
      });

      function paint() {
        if (!frame) return;
        const box = crop.layout(iw, ih, zoom, cx, cy, frame);
        photo.style.width = `${box.width}px`;
        photo.style.height = `${box.height}px`;
        photo.style.left = `${box.left}px`;
        photo.style.top = `${box.top}px`;
      }

      function measure() {
        const next = stage.clientWidth;
        if (next && next !== frame) { frame = next; paint(); }
      }

      /* -------- dragging and pinching ---------------------------------- *
       * Pointer events cover mouse, touch and pen in one path. `touch-action:
       * none` on the stage is what stops iOS scrolling the sheet instead of
       * moving the photo — without it the whole control feels broken on the
       * one device it exists for.
       * ----------------------------------------------------------------- */
      const pointers = new Map();
      let pinchStart = null;

      const spread = () => {
        const [a, b] = [...pointers.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
      };

      stage.addEventListener('pointerdown', (e) => {
        // ⚠️ CAPTURE IS AN OPTIMISATION, NOT THE MECHANISM, and it must not be
        // able to take the drag down with it. setPointerCapture throws
        // NotFoundError whenever the id is not an active pointer — and because
        // it was the FIRST statement, that threw before the pointer was ever
        // recorded, so pointermove found nothing and the photo would not move
        // at all. Capture only buys us events that stray outside the stage
        // mid-drag; tracking is what actually moves the picture, so it goes
        // first and the capture is allowed to fail.
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { stage.setPointerCapture(e.pointerId); } catch (_) { /* drag still works */ }
        if (pointers.size === 2) {
          pinchStart = { dist: spread(), side: crop.sideForZoom(iw, ih, zoom) };
        }
      });

      stage.addEventListener('pointermove', (e) => {
        const prev = pointers.get(e.pointerId);
        if (!prev) return;
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size >= 2 && pinchStart) {
          const ratio = spread() / (pinchStart.dist || 1);
          // Fingers apart → a smaller crop square → more zoom.
          const nextZoom = crop.zoomForSide(iw, ih, pinchStart.side / (ratio || 1));
          ({ zoom, cx, cy } = crop.zoomTo(iw, ih, nextZoom, cx, cy));
          slider.value = String(zoom);
        } else {
          ({ cx, cy } = crop.panBy(iw, ih, zoom, cx, cy, dx, dy, frame));
        }
        paint();
      });

      const lift = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchStart = null;
      };
      stage.addEventListener('pointerup', lift);
      stage.addEventListener('pointercancel', lift);

      stage.addEventListener('wheel', (e) => {
        if (!zoomable) return;
        e.preventDefault();
        const next = Math.min(1, Math.max(0, zoom - e.deltaY * 0.0015));
        ({ zoom, cx, cy } = crop.zoomTo(iw, ih, next, cx, cy));
        slider.value = String(zoom);
        paint();
      }, { passive: false });

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (observer) observer.disconnect();
        release();
        resolve(value);
      };

      const { close } = openSheet({
        title: 'Position your photo',
        body: el('div', { class: 'crop-body' },
          stage,
          el('div', { class: 'crop-controls' },
            icon('person', 16),
            slider,
            icon('person', 24),
          ),
          el('div', { class: 'field-help', text: zoomable
            ? 'Drag the photo to move it, and use the slider to zoom. Whatever is inside the '
              + 'circle is what your profile picture will be.'
            : 'Drag the photo to move it. Whatever is inside the circle is what your profile '
              + 'picture will be. This image is too small to zoom.' }),
        ),
        footer: el('div', { class: 'btn-row' },
          el('button', { class: 'btn ghost', text: 'Cancel', onClick: () => close() }),
          el('button', {
            class: 'btn primary', text: 'Use photo',
            onClick: () => {
              let dataUrl;
              try {
                dataUrl = renderCrop(img, crop.cropRect(iw, ih, zoom, cx, cy), size);
              } catch (err) {
                close();
                reject(err instanceof Error ? err : new Error('That image could not be saved.'));
                return;
              }
              settled = true;                   // claim it before onClose fires
              if (observer) observer.disconnect();
              release();
              close();
              // The crop travels with the picture. Without it, Edit would
              // reopen in the middle of the photo and throw away the framing
              // the person just chose.
              resolve({ dataUrl, source, crop: { zoom, cx, cy } });
            },
          }),
        ),
        // Covers the X, the backdrop and Escape in one place, so every way out
        // of the sheet resolves rather than leaving the caller awaiting forever.
        onClose: () => finish(null),
      });

      // The stage has no size until it is in the document.
      measure();
      const observer = typeof ResizeObserver === 'function'
        ? new ResizeObserver(measure) : null;
      if (observer) observer.observe(stage);
    }).catch(reject);
  });
}

/** The chosen square → a small JPEG data URL. */
function renderCrop(img, rect, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('That image could not be saved.');
  // Resized to 256px and JPEG-compressed here rather than stored whole: a 12 MB
  // camera photo becomes ~20 KB, and the settings document shares a 1 MiB
  // ceiling with everything else in it.
  ctx.drawImage(img, rect.x, rect.y, rect.side, rect.side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.82);
}

/* ------------------------------------------------------------------ *
 * Who can see you, and the name they see
 *
 * Tim, 2026-09-08: *"I want to get rid of the 'You' and 'Friends' tab in the
 * home page. To do this, move the privacy changes and display name into the
 * account menu."* Both controls already existed on the Friends screen; this is
 * the same two sheets opened from the screen that owns the person.
 *
 * 🚨 THE CURRENT SETTING AND WHAT IT MEANS ARE ON THE SCREEN, NOT BEHIND A "?".
 * Rule 9's own worked example is this control: what a stranger can see about you
 * is WHAT, and somebody deciding whether to be public has to be able to read the
 * whole answer without asking for it. So the row carries VISIBILITY_DETAIL in
 * full — the same sentence the Friends screen shows — and the ? on this screen
 * is spent on things that explain rather than state.
 *
 * ⚠️ IT NORMALISES RATHER THAN CARRYING ITS OWN FALLBACK. `views-social.js`'s
 * `visibilityRow()` records the bug: written as `LABEL[visibility] ||
 * LABEL[PRIVATE]`, it went on saying "Private" for an account with no stored
 * choice after the default flipped to public, while the publisher treated the
 * same account as public. A screen and a database disagreeing about who can see
 * somebody's training is the worst version of that there is. One definition of
 * the default, in social.js.
 * ------------------------------------------------------------------ */

/**
 * Why there is nothing to set, in the person's words — one sentence each,
 * because "private" and "there is no account" are not the same answer and they
 * send somebody to two different next steps.
 *
 * ⚠️ NONE OF THEM CLAIMS NOTHING IS PUBLISHED. An anonymous account is a real
 * cloud uid and `republish()` does not refuse it, so "nobody can see you" would
 * be a reassurance this screen cannot back. They say what is missing and what
 * to do about it, and nothing more.
 *
 * ⚠️ AND `offline` NAMES NO SETTING. The stored value is the last one this
 * device saw; an account switched to private on a phone would still read
 * "Public" here, which is precisely the screen-and-database disagreement the
 * comment above exists to prevent.
 */
const SHARING_UNAVAILABLE = {
  local: 'This copy of the app keeps everything in this browser, so there is no account for '
    + 'anybody to find or follow.',
  offline: 'You are offline. Who can see your account is a setting on the account itself, so it '
    + 'cannot be checked or changed until you are back online.',
  anonymous: 'Choosing who can see you needs a real account. Add an email or Google sign-in and '
    + 'you can set it here.',
};

/**
 * The two rows, or the sentence saying why there are none.
 *
 * ⚠️ AVAILABILITY IS RESOLVED BEFORE ANYTHING IS DRAWN — the same shape as
 * `noteToDeveloper()` above, and for the same reason. A visibility row on an
 * account with no cloud is a control that lies: tapping it would offer a choice
 * `social.setVisibility()` cannot store.
 */
async function sharingRows() {
  let state;
  // `social.state()` reads the graph over the network, so a dead connection
  // arrives as a throw rather than as a reason. Treat it as the reason it is.
  try { state = await social.state(); }
  catch (_) { state = { available: false, reason: 'offline' }; }

  const heading = el('div', { class: 'section-label', text: 'Who can see you' });

  if (!state.available) {
    // The demo says nothing at all, exactly as the note-to-developer card does:
    // nobody enters an invented account in order to adjust its privacy, and a
    // paragraph explaining that would be noise on a screen being looked around.
    const why = SHARING_UNAVAILABLE[state.reason];
    if (!why) return [];
    return [heading, el('div', { class: 'field-help', text: why })];
  }

  const visibility = normalizeVisibility(state.visibility);

  return [
    heading,

    el('button', {
      class: 'row as-button',
      onClick: () => visibilitySheet(visibility, async (next) => {
        try {
          await social.setVisibility(next);
          toast(next === PUBLIC_ACCOUNT ? 'Your account is public.' : 'Your account is private.');
          refresh();
        } catch (err) { toast(err.message); }
      }),
    },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: VISIBILITY_LABEL[visibility] }),
        // `.wrap`, because this is a sentence rather than a value — an
        // ellipsised consequence is a consequence nobody reads.
        el('div', { class: 'row-sub wrap', text: VISIBILITY_DETAIL[visibility] }),
      ),
      chevron(),
    ),

    /* The name, on the row that shows it. ⚠️ The row states the name rather
     * than describing what a display name is: it is the one thing every person
     * who can see you sees, and "Not set yet" is the case worth spotting from
     * across the screen. */
    /* 🚨 THE SECOND ARGUMENT IS NOT OPTIONAL HERE, AND IT WAS A REAL BUG CAUGHT
     * BEFORE IT SHIPPED. `renameSheet` used to end in `views-social.js`'s own
     * `refresh()` — `refreshRoute('#/social')` — and `refreshRoute` rewrites the
     * hash when it differs. Renaming yourself from this screen would have saved
     * the name and then dropped you on the Friends list, with a back arrow
     * pointing at a screen you never opened. It takes an `after` callback now,
     * so the caller says where it is. ⚠️ Reimplementing the sheet here instead
     * would have been a second way for a published name to disagree with the
     * stored one, which is what its own docblock says the export exists to
     * prevent. */
    el('button', {
      class: 'row as-button',
      onClick: () => renameSheet(state.name, refresh),
    },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: 'Your display name' }),
        el('div', { class: 'row-sub', text: state.name || 'Not set yet' }),
      ),
      chevron(),
    ),
  ];
}

/** Everything personal that used to live in Settings: profile, data, delete. */
async function personalSections({ mode }) {
  const [settings, profile, cloud, sharing] = await Promise.all([
    store.getSettings(), store.getProfile(), store.cloudUsage(), sharingRows(),
  ]);

  // Say what is missing rather than just "Profile" — this gates the muscle
  // map, and a silent empty profile is why it would look broken.
  const profileLine = profile.missing.length
    ? `Add your ${profile.missing.join(' and ')} to rank your muscle groups`
    : `${profile.gender === 'female' ? 'Female' : 'Male'}`
      + (profile.age ? `, ${profile.age}` : '')
      + `, ${units.withUnit(profile.bodyWeight)}`;

  async function doExport() {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `fitness-tracker-backup-${todayISO()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup downloaded');
  }

  const fileInput = el('input', {
    type: 'file', accept: 'application/json', style: 'display:none',
    onChange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      // ⚠️ READ AND CHECKED BEFORE ANYTHING IS ASKED, so the sheet can say what
      // is actually in the file. A confirmation that cannot name what it is
      // about to do is a speed bump, not a safeguard.
      let data, summary;
      try {
        data = JSON.parse(await file.text());
        summary = store.inspectBackup(data);
      } catch (err) {
        toast(err.message || 'That file could not be read');
        e.target.value = '';
        return;
      }
      e.target.value = '';

      const parts = [];
      if (summary.counts.sessions) parts.push(`${summary.counts.sessions} workout records`);
      if (summary.counts.workouts) parts.push(`${summary.counts.workouts} workouts`);
      if (summary.counts.benchmarks) parts.push(`${summary.counts.benchmarks} benchmarks`);
      if (summary.counts.bodyWeight) parts.push(`${summary.counts.bodyWeight} weigh-ins`);
      const what = parts.length ? parts.join(', ') : `${summary.total} records`;

      confirmSheet({
        title: 'Restore this backup?',
        message: `It holds ${what}. Restoring REPLACES everything in this account — `
          + 'anything you have logged since that backup was made will be gone. '
          + 'This cannot be undone.',
        confirmLabel: 'Replace everything',
        onConfirm: async () => {
          try {
            await store.importAll(data);
            toast('Backup restored');
            go('#/home');
          } catch (err) {
            toast(err.message || 'That file could not be read');
          }
        },
      });
    },
  });

  return [
    el('div', { class: 'section-label', text: 'Profile' }),
    el('a', { class: 'row', href: '#/profile' },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title', text: 'Your details' }),
        el('div', { class: 'row-sub', text: profileLine }),
      ),
      el('span', { class: 'row-chev' }, chevron()),
    ),

    /* ⚠️ WITH THE PERSON, NOT WITH THE DATA CONTROLS — directly under "Your
     * details" and far from "Delete all data". Who can see you and what they
     * call you are facts about the person this screen is now the home of; the
     * comment on the note-to-developer card below says why the irreversible
     * button is kept away from anything people scan past on the way down. */
    ...sharing,

    /* ⚠️ THE HEADING KEEPS THE ONE FACT THAT CHANGES WHAT THE DATA IS, and the
     * ? takes the rest — 2026-09-08, Rule 9. "Only in this browser" is not a
     * caveat about a number, it is the difference between data that survives
     * losing the phone and data that does not, and this module's own header
     * says that must never be buried. So the local branch still says it in the
     * open; what moved is the advice about what to do next. */
    el('div', { class: 'help-line' },
      el('div', { class: 'section-label', text: mode === 'cloud-secured'
        ? 'Your data' : 'Your data — only in this browser' }),
      helpDot(mode === 'cloud-secured'
        ? 'Everything syncs to your account and is on any device you sign in on. Logging still '
          + 'works with no signal — it uploads when you reconnect. A downloaded backup is the only '
          + 'copy you control directly.'
        : 'Clearing your browsing data, losing this device or switching phones erases it, and '
          + 'nothing can recover it. An account fixes that; a downloaded backup is the other way.',
      { label: 'What happens to your data' })),
    el('div', { class: 'card' },
      cloudFullWarning(cloud),
      el('button', { class: 'btn block', text: 'Download backup', onClick: doExport }),
      el('button', { class: 'btn ghost block', text: 'Restore from backup', onClick: () => fileInput.click() }),
      fileInput,
    ),

    /* ⚠️ A SEPARATE CARD FROM BACKUP/RESTORE, deliberately. Restore REPLACES
     * this account with a snapshot of itself; import ADDS somebody else's
     * export to what is already here. They read as neighbours and they are
     * opposites, and one of them cannot be undone — putting the second inside
     * the first card is how somebody taps the wrong one. */
    el('div', { class: 'card' },
      el('div', { class: 'help-line' },
        el('div', { class: 'section-label', text: 'Bring in data from another app' }),
        helpDot('Export your data from Strava, Apple Health, MacroFactor, Cronometer or a '
          + 'spreadsheet, then bring the file in here. Nothing is sent anywhere — the file is read '
          + 'on this device, and the next screen says what it found before anything is written.',
        { label: 'How importing works' })),
      el('button', {
        class: 'btn ghost block', text: 'Import from a file', onClick: () => go('#/import'),
      }),
    ),

    /* ⚠️ ABOVE "Delete all data" AND BELOW EVERYTHING ELSE, which is a placement
     * rather than an accident. It has to be findable — a feedback channel nobody
     * sees collects nothing — and it must not sit next to the irreversible
     * button, because the two get tapped in the same downward scan. */
    noteToDeveloper(),

    el('button', {
      class: 'btn danger block',
      text: 'Delete all data',
      onClick: () => confirmSheet({
        title: 'Delete everything?',
        message: 'Every workout, record, benchmark and custom exercise will be permanently erased. Download a backup first if you are not sure.',
        confirmLabel: 'Delete everything',
        onConfirm: async () => { await store.clearAll(); toast('All data deleted'); go('#/home'); },
      }),
    }),
  ];
}

/* ------------------------------------------------------------------ *
 * A NOTE TO THE DEVELOPER — 2026-09-04, and deliberately temporary
 * ------------------------------------------------------------------ *
 *
 * Tim: *"adding a temporary section to the app that allows the user to write a
 * note or idea straight to the developer (me) would be nice to have."*
 *
 * ⚠️ IT EXISTS TO CATCH WHAT A NEW USER THINKS BEFORE THEY GET USED TO THE APP,
 * which is the one thing that cannot be recovered later. **It should come out
 * when the first users stop being new** — otherwise it quietly becomes a support
 * inbox nobody is staffing.
 *
 * ⚠️ THE STATE IS RESOLVED BEFORE THE CARD IS DRAWN, not on submit. A textarea
 * somebody fills in and then cannot send is worse than no textarea: they have
 * already spent the effort, and the refusal arrives at the moment it costs most.
 */
function noteToDeveloper() {
  const host = el('div', { class: 'card' });

  const draw = async () => {
    const st = await feedback.state();

    if (!st.available) {
      /* ⚠️ THE DEMO SAYS NOTHING AT ALL. Everywhere else in this app the demo
       * explains why a cloud feature is off, because those are features
       * somebody came looking for. Nobody opens the demo in order to send
       * feedback about it, and a card explaining that the invented account
       * cannot contact the developer is pure noise on a screen being evaluated
       * by a stranger. */
      if (st.reason === 'demo') { setChildren(host); host.className = ''; return; }

      host.className = 'card';
      setChildren(host,
        el('div', { class: 'section-label', text: 'Tell the developer something' }),
        el('div', { class: 'field-help', text: FEEDBACK_UNAVAILABLE[st.reason]
          || 'Notes are unavailable right now.' }),
      );
      return;
    }

    const box = el('textarea', {
      class: 'input', rows: 3, maxLength: 1000,
      placeholder: 'An idea, something confusing, something broken…',
      'aria-label': 'Your note to the developer',
    });
    const send = el('button', { class: 'btn primary block', text: 'Send' });

    send.addEventListener('click', async () => {
      // Guarded against a double tap: a second note is a duplicate, and the
      // sender cannot see or delete either of them.
      if (send.disabled) return;
      send.disabled = true;
      try {
        await feedback.send(box.value);
        /* ⚠️ THE CARD IS REPLACED BY A THANK-YOU RATHER THAN CLEARED. An empty
         * box that used to have words in it is ambiguous — it looks the same as
         * a box that ate them — and this is the one flow where the sender can
         * never check whether it arrived, because they cannot read notes back
         * (see firestore.rules). Saying so is the only receipt they get. */
        setChildren(host,
          el('div', { class: 'section-label', text: 'Sent — thank you' }),
          el('div', { class: 'field-help', text:
            'It goes straight to the developer. There is no reply here, so if you want an answer, '
            + 'leave a way to reach you in the note itself.' }),
          el('button', { class: 'btn ghost block', text: 'Write another', onClick: draw }),
        );
      } catch (err) {
        send.disabled = false;
        // The reason, in the person's words — buildNote() and feedback.state()
        // both return sentences rather than codes for exactly this line.
        toast(err && err.message ? err.message : 'Could not send that.');
      }
    });

    host.className = 'card';
    setChildren(host,
      /* ⚠️ The placeholder in the box already says WHAT to write — "an idea,
       * something confusing, something broken". What was above it explained
       * where the note goes and why the app is asking, which is WHY. */
      el('div', { class: 'help-line' },
        el('div', { class: 'section-label', text: 'Tell the developer something' }),
        helpDot('This app is new and being worked on. Anything confusing, broken or missing goes '
          + 'straight to the person building it. There is no reply here, so leave a way to reach '
          + 'you in the note if you want one.',
        { label: 'Where this note goes' })),
      box,
      send,
      // Only Tim sees this, and only because the rules let him read them.
      st.developer
        ? el('a', { class: 'btn ghost block', href: '#/notes', text: 'Read notes' })
        : null,
    );
  };

  draw();
  return host;
}

const FEEDBACK_UNAVAILABLE = {
  offline: 'You are offline. Notes are sent straight away rather than queued, so come back when you have a connection.',
  local: 'Sending a note needs an account, so there is somebody to reply to.',
  anonymous: 'Add an email to your account to send a note — otherwise there is nobody to reply to.',
};

export async function AccountView() {
  // Before anything asks the account a question. In the demo there is no
  // account to ask about, and every control on the normal screen — upload,
  // sign out, delete — would be either meaningless or alarming.
  if (demo.active()) return demoScreen();

  const state = await auth.state();
  const settings = await store.getSettings();

  if (!auth.configured()) {
    return screenShell({
      title: 'Account',
      back: () => go('#/home'),
      scroll: [
        avatarCard(settings, null),
        emptyState(
          'Accounts are not switched on yet',
          'This app stores everything in this browser. Cloud accounts need a Firebase project — see docs/firebase-setup.md. Until then, Download backup below keeps a copy.',
        ),
        ...await personalSections({ mode: 'local' }),
        demoCard(),
      ],
    });
  }

  if (state.mode === 'local') return offlineScreen(state, await personalSections({ mode: 'local' }), settings);

  const user = state.user || {};
  return user.isAnonymous
    ? anonymousScreen(await personalSections({ mode: 'anonymous' }), settings)
    : signedInScreen(user, await personalSections({ mode: 'cloud-secured' }), settings);
}

/* ------------------------------------------------------------------ *
 * Configured, but the cloud is not reachable
 *
 * The version of this screen that led with "your account could not be reached"
 * and then printed a raw module-import URL sent Tim looking for a bug in the
 * app when his wi-fi was off. Three things it now gets right: it names the
 * likely cause, it does not imply the account itself is broken or gone, and
 * the technical string is available but is not the headline.
 * ------------------------------------------------------------------ */

function offlineScreen(state, sections = [], settings = {}) {
  // Framed as a CONNECTION problem in both branches. The failure that lands
  // anyone here is an SDK that would not load, which is essentially always
  // connectivity — leading with "your account" sent Tim looking for a bug in
  // the app when his wi-fi was off.
  const OFFLINE = {
    heading: 'You’re offline',
    body: 'This device has no internet connection, so the app can’t reach your account right '
      + 'now. Keep logging — everything is saved here and uploads by itself when you’re '
      + 'back online.',
  };
  const UNREACHABLE = {
    heading: 'Can’t connect',
    body: 'The app can’t reach the network at the moment. This is a connection problem rather '
      + 'than anything wrong with your account. Keep logging — everything is saved on this '
      + 'device and uploads once the connection returns.',
  };

  const headingEl = el('div', { class: 'section-label' });
  const status = el('div', { class: 'field-help' });
  const paint = (copy) => { headingEl.textContent = copy.heading; status.textContent = copy.body; };
  paint(state.offline ? OFFLINE : UNREACHABLE);

  // navigator.onLine says "true" for a captive portal or a dead upstream, so
  // confirm by actually asking the network and correct the wording if it
  // disagrees. Rendered first and refined after, rather than blocking on it.
  if (!state.offline) {
    probeOffline().then((reallyOffline) => {
      if (reallyOffline && headingEl.isConnected) paint(OFFLINE);
    }).catch(() => {});
  }

  const retryBtn = el('button', { class: 'btn primary block', text: 'Try again' });

  async function attempt(auto) {
    retryBtn.disabled = true;
    retryBtn.textContent = 'Checking…';
    const next = await auth.retry();
    if (next.mode === 'cloud') { refresh(); return; }
    retryBtn.disabled = false;
    retryBtn.textContent = 'Try again';
    // Saying "still offline" is the point: the old button reloaded the page and
    // showed the identical error, which read as the button doing nothing.
    if (!auto) {
      const reallyOffline = next.offline || await probeOffline();
      status.textContent = reallyOffline
        ? 'Still offline. Check your wi-fi or mobile data, then try again.'
        : 'Still can’t connect. It may be a moment before it comes back.';
    }
  }
  retryBtn.addEventListener('click', () => attempt(false));

  // Coming back online is the common ending, so take it without being asked.
  const onOnline = () => attempt(true);
  window.addEventListener('online', onOnline);
  setTimeout(() => {
    if (!retryBtn.isConnected) window.removeEventListener('online', onOnline);
  }, 0);

  return screenShell({
    title: 'Account',
    back: () => go('#/home'),
    scroll: [
      el('div', { class: 'card' },
        headingEl,

        // You have NOT been signed out — the app simply cannot ask who you are.
        // Saying so is the difference between "my account is gone" and "I'm on
        // a bad connection".
        state.lastAccount && state.lastAccount.email
          ? el('div', { class: 'field-help' },
              'You’re still signed in as ',
              el('b', { text: state.lastAccount.email }),
              '. You haven’t been signed out — the app just can’t check right now.')
          : null,

        status,

        el('div', { class: 'field-help' },
          'Your workouts are safe either way. Download backup below keeps a copy on this device.'),

        retryBtn,

        // Kept, because it is what makes a real fault diagnosable — just not as
        // the first thing a user reads. Always available, never expanded: the
        // problem was never that this string existed, it was that it was the
        // headline.
        state.error
          ? el('details', { class: 'tech-detail' },
              el('summary', { text: 'Technical detail' }),
              el('div', { class: 'field-help mono', text: state.error }))
          : null,
      ),

      avatarCard(settings, state.lastAccount),
      ...sections,

      // Offered here too, and this is the branch where it is most wanted: no
      // connection, nothing to sign into, and nothing to look at either.
      demoCard(),
    ],
  });
}

/* ------------------------------------------------------------------ *
 * The Google button
 *
 * Shared by both screens because the failure handling is the fiddly part and
 * having two copies of it is how they drift.
 *
 * A cancelled popup must never look like a dead button. Firebase raises
 * auth/popup-closed-by-user both when a person closes the window AND when the
 * SDK loses its handle on it (Cross-Origin-Opener-Policy), so "cancelled" is
 * not reliably a decision — but auto-redirecting on it would yank someone to
 * Google the instant they backed out on purpose. So: say what happened, and
 * offer the redirect as one tap rather than taking it for them.
 * ------------------------------------------------------------------ */

/**
 * ⚠️ WHAT TIM SAW ON AN IPHONE, 2026-08-21: "it opens a popup for a second, then
 * quickly closes it and nothing happens." Three separate faults met there, and
 * only the first is about Google at all.
 *
 * 1. **A hung promise left a dead button.** `run()` awaits its function, and on
 *    iOS Safari the popup's promise can simply never settle — the handler page
 *    loses the storage it needs, the window closes, and the SDK is left holding
 *    a promise nobody will resolve. No throw means no catch, so the button sat
 *    on "Opening…" for ever and *nothing happened* in the most literal sense.
 * 2. **Every failure was a 2.4-second toast.** On a phone that is indisting-
 *    uishable from nothing happening, which is exactly how it got reported.
 * 3. **The escape hatch could not work.** "Continue in this window instead" is
 *    `signInWithRedirect`, and Firebase document that as broken whenever the
 *    authDomain is a different origin from the app — which is this project on
 *    every browser Tim owns. The one route offered as the reliable one was the
 *    one guaranteed to fail.
 *
 * ✅ UPDATE 2026-08-22: GOOGLE SIGN-IN NOW WORKS ON HIS IPHONE, in the app
 * installed to the home screen. Fault 3 is why, and not in the way it was
 * written: taking redirect away from the installed PWA left it on the POPUP,
 * which works there. The premise that an installed iOS app blocks popups —
 * which is what sent it to redirect in the first place — was simply false.
 * Redirect still cannot complete cross-origin, so nothing here relaxes.
 * ⚠️ Untested since the fix: an ordinary Safari tab, which is probably where
 * the original report came from.
 *
 * ⚠️ THE UI IS RACED, NOT THE SIGN-IN. Nothing here cancels the auth promise: a
 * real sign-in behind two-factor can genuinely take minutes, and aborting one
 * because a timer expired would be a far worse bug than the one being fixed.
 * The timer only takes the BUTTON back and says what to do; if the sign-in does
 * eventually land, the auth listener still picks it up.
 */
const POPUP_PATIENCE_MS = 40000;

function googleButton({ label, className, onDone }) {
  const btn = el('button', { class: className, text: label });

  // Persistent, not a toast. This screen is where somebody has just watched a
  // window flash and vanish, and it owes them a sentence that stays put.
  const status = el('div', { class: 'field-help', hidden: true });
  const say = (text) => { status.textContent = text; status.hidden = false; };

  const escape = el('button', {
    class: 'btn block', hidden: true,
    text: 'Continue in this window instead',
    onClick: async () => {
      await run(escape, 'Redirecting…', () => auth.signInGoogle({ forceRedirect: true }));
    },
  });

  // Offered only where it can actually finish. Where it cannot, the honest
  // advice is the route that does work on this device, which is email.
  async function offerFallback() {
    const { redirectCanComplete } = await import('./firebase-backend.js');
    const { FIREBASE_CONFIG } = await import('./firebase-config.js');
    if (redirectCanComplete(FIREBASE_CONFIG)) {
      escape.hidden = false;
      return 'Or continue in this window instead.';
    }
    // ⚠️ Says what HAPPENED, not what this browser can do. It used to read
    // "Google sign-in does not complete in this browser", which was a prediction
    // — and on 2026-08-22 a real iPhone completed exactly that sign-in in the
    // installed app. Telling somebody their browser cannot do the thing it just
    // failed at once is a worse error than telling them it failed.
    return 'That did not complete. Use an email and password below — it works '
      + 'everywhere, and it keeps everything you have already logged.';
  }

  const release = () => { btn.disabled = false; btn.textContent = label; };

  btn.addEventListener('click', async () => {
    status.hidden = true;
    let settled = false;

    const patience = setTimeout(async () => {
      if (settled) return;
      // The promise is still out there and may yet succeed — this only stops
      // the screen pretending to be busy.
      release();
      say('The sign-in window closed without finishing. ' + await offerFallback());
    }, POPUP_PATIENCE_MS);

    let cancelled = false;
    const ok = await run(btn, 'Opening…', async () => {
      try {
        const res = await auth.signInGoogle();
        if (res && res.status === 'cancelled') {
          cancelled = true;
          say('The sign-in window closed before finishing. ' + await offerFallback());
          return;
        }
        if (res && res.status === 'signed-in') toast('Account secured');
      } catch (err) {
        // ⚠️ The code goes ON THE SCREEN. Everything above is inference about a
        // device nobody here can run; the code is the fact. Without it the next
        // report is "nothing happens" again and we are no better off.
        say(`Google sign-in failed: ${err && err.code ? err.code : 'no error code'}. `
          + await offerFallback());
        cancelled = true;
        return;
      }
    });

    settled = true;
    clearTimeout(patience);

    if (cancelled) {
      // run() hands the button back only when fn THROWS, on the assumption that
      // success navigates away. A cancelled sign-in does neither, so without
      // this the button sits on "Opening…" for good — which is the dead button
      // all over again, one layer up.
      release();
      return;
    }
    // 'redirecting' navigates away, so nothing after this runs in that case.
    if (ok) onDone();
  });

  return { btn, escape, status };
}

/* ------------------------------------------------------------------ *
 * Anonymous — the upgrade path
 * ------------------------------------------------------------------ */

function anonymousScreen(sections = [], settings = {}) {
  const email = el('input', { class: 'input', type: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
  const password = el('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'At least 6 characters' });

  const google = googleButton({
    label: 'Continue with Google',
    className: 'btn primary block',
    onDone: refresh,
  });
  const googleBtn = google.btn;

  const createBtn = el('button', {
    class: 'btn block',
    text: 'Create account',
    onClick: async () => {
      const e = email.value.trim(), p = password.value;
      if (!e || !p) { toast('Enter an email and a password'); return; }
      const ok = await run(createBtn, 'Creating…', async () => {
        await auth.signUpEmail(e, p);
        toast('Account secured');
      });
      if (ok) refresh();
    },
  });

  return screenShell({
    title: 'Account',
    back: () => go('#/home'),
    scroll: [
      /* ⚠️ THE ONE BLOCK ON THIS SCREEN THAT DID NOT GO BEHIND A "?" — and the
       * module header says why: this screen must never imply data is safe when
       * it is not, so the risk is stated rather than asked for. What moved is
       * the reassurance about what an account does with what you have already
       * logged, which is now true without anybody being told (store.js's
       * `absorbThisDevice`). */
      el('div', { class: 'card' },
        el('div', { class: 'help-line' },
          el('div', { class: 'section-label', text: 'Your data is not backed up' }),
          helpDot('Creating an account keeps everything you have already logged — it is attached '
            + 'to the account rather than replaced by it, and it happens on its own. Signing in to '
            + 'an account you already have is the other case, and that one shows you that '
            + 'account\'s data instead.',
          { label: 'What happens to what you have logged' })),
        el('div', { class: 'field-help' },
          'Everything you have logged lives only in this browser. Clear your browsing data, switch '
          + 'phones or lose this device and it is gone.'),
      ),

      googleBtn,
      google.status,
      google.escape,

      el('div', { class: 'or-rule' }, el('span', { text: 'or' })),

      el('div', { class: 'card' },
        el('div', { class: 'field' }, el('label', { text: 'Email' }), email),
        el('div', { class: 'field' }, el('label', { text: 'Password' }), password),
        createBtn,
      ),

      el('div', { class: 'field-help', style: 'text-align:center' },
        'Already have an account? '),
      el('button', {
        class: 'btn ghost block',
        text: 'Sign in instead',
        onClick: () => go('#/signin'),
      }),

      avatarCard(settings, null),
      ...sections,

      el('div', { class: 'or-rule' }, el('span', { text: 'or' })),
      demoCard(),
    ],
  });
}

/* ------------------------------------------------------------------ *
 * Signed in
 * ------------------------------------------------------------------ */

async function signedInScreen(user, sections = [], settings = {}) {
  // Only an email/password account has a password to change. A Google account
  // has nothing here to adjust — its details live in the Google account.
  const hasPassword = (user.providers || []).includes('password');

  const deleteBtn = el('button', {
    class: 'btn danger block',
    text: 'Delete account',
    onClick: () => {
      // Requires the password because it is irreversible, and because Firebase
      // refuses the operation on a stale session anyway.
      const pw = hasPassword
        ? el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Your password' })
        : null;

      let handle = null;
      const confirmBtn = el('button', {
        class: 'btn danger block',
        text: 'Delete everything permanently',
        onClick: async () => {
          if (hasPassword && !pw.value) { toast('Enter your password'); return; }
          const ok = await run(confirmBtn, 'Deleting…', async () => {
            await auth.deleteAccount(pw ? pw.value : null);
            toast('Account deleted');
          });
          if (ok) { if (handle) handle.close(); go('#/home'); }
        },
      });

      handle = openSheet({
        title: 'Delete your account?',
        body: el('div', { class: 'card' },
          el('p', { class: 'field-help' },
            'This erases every workout, record, benchmark and custom exercise from your account, '
            + 'permanently, on every device. It cannot be undone. Download a backup first if there '
            + 'is any chance you want this data later.'),
          pw ? el('div', { class: 'field' }, el('label', { text: 'Confirm your password' }), pw) : null,
        ),
        footer: confirmBtn,
      });
    },
  });

  /* 🚨 "LEFT ON THIS DEVICE" IS GONE — 2026-09-08, Tim: *"the 'left on this
   * device' part should be removed. When a user creates an account if they
   * already have items uploaded to an empty page that they're using then that
   * information should automatically upload to their account. there should be
   * no button for it."*
   *
   * It was a card counting the rows still in this browser and a button to send
   * them up, i.e. the app asking the user to do its filing. `absorbThisDevice()`
   * in store.js now runs on the two paths that CREATE an account, so by the time
   * anybody reaches this screen there is nothing left to sweep up. ⚠️ It is
   * deliberately not automatic on SIGN-IN — see the comment there. */

  const signOutBtn = el('button', {
    class: 'btn ghost block',
    text: 'Sign out',
    onClick: () => confirmSheet({
      title: 'Sign out?',
      message: 'Your data stays in your account. This device will start a fresh empty session until you sign back in.',
      confirmLabel: 'Sign out',
      danger: false,
      onConfirm: async () => {
        const ok = await run(signOutBtn, 'Signing out…', async () => {
          await auth.signOut();
          toast('Signed out');
        });
        if (ok) go('#/home');
      },
    }),
  });

  return screenShell({
    title: 'Account',
    back: () => go('#/home'),
    scroll: [
      /* ⚠️ THE "Signed in" CARD WENT WITH IT. The email is on the avatar card
       * directly above, which is what "signed in" was telling anybody, and the
       * sentence about syncing is now the "Your data" ? two sections down —
       * one place saying what happens to your data instead of two. */
      avatarCard(settings, user),

      ...sections,

      demoCard(),

      el('div', { class: 'section-label', text: 'Account' }),
      hasPassword ? passwordCard() : null,
      signOutBtn,
      deleteBtn,
    ],
  });
}

/* ---- change password (email accounts only) ---- */

function passwordCard() {
  const current = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Current password' });
  const next = el('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'New password, 6+ characters' });

  const saveBtn = el('button', {
    class: 'btn block',
    text: 'Change password',
    onClick: async () => {
      if (!current.value || !next.value) { toast('Fill in both passwords'); return; }
      if (next.value.length < 6) { toast('Use at least 6 characters'); return; }
      const ok = await run(saveBtn, 'Saving…', async () => {
        await auth.changePassword(current.value, next.value);
        toast('Password changed');
      });
      if (ok) { current.value = ''; next.value = ''; saveBtn.disabled = false; saveBtn.textContent = 'Change password'; }
    },
  });

  return el('div', { class: 'card' },
    el('div', { class: 'field' }, el('label', { text: 'Current password' }), current),
    el('div', { class: 'field' }, el('label', { text: 'New password' }), next),
    saveBtn,
  );
}

/* ------------------------------------------------------------------ *
 * Sign in to an existing account
 * ------------------------------------------------------------------ */

/**
 * 🚨 THE DEVELOPER'S INBOX — the only screen in this app one account can open
 * and another cannot.
 *
 * ⚠️ AND THE SCREEN IS NOT WHAT PROTECTS IT. `feedback.list()` returns [] for
 * anybody who is not the developer because `firestore.rules` refuses the read,
 * not because this function checked. The empty state below therefore has to be
 * honest for two completely different people: Tim with no notes yet, and
 * somebody else who typed the URL. **It says nothing about what it is hiding**,
 * because a screen that says "you are not the developer" is a screen that
 * confirms there is something worth being.
 *
 * ⚠️ These are other people's words, so nothing here is published, cached or
 * shared — it is read on open and gone when you leave.
 */
export async function NotesView() {
  const [notes, st] = await Promise.all([feedback.list(), feedback.state()]);

  const body = el('div', { class: 'pane-scroll' });

  const draw = () => {
    if (!notes.length) {
      setChildren(body, emptyState(
        'Nothing here',
        st.developer
          ? 'No notes have been sent yet. They arrive here as soon as somebody writes one.'
          : 'There is nothing on this screen.',
      ));
      return;
    }

    setChildren(body,
      el('div', { class: 'field-help', text:
        `${notes.length} note${notes.length === 1 ? '' : 's'}, newest first.` }),
      ...notes.map((n) => {
        const card = el('div', { class: 'card' },
          el('div', { class: 'muscle-meta', text:
            `${n.name || 'Someone'} · ${n.createdAt ? fmtDateShort(n.createdAt.slice(0, 10)) : 'undated'}` }),
          // ⚠️ `text`, never `html`. A note is somebody else's free text and it
          // is the only such text in this app; rendering it as markup would be
          // a script injection with an invitation attached.
          el('div', { class: 'note-body', text: n.text || '' }),
          n.platform ? el('div', { class: 'muscle-meta', text: n.platform }) : null,
          el('button', {
            class: 'btn ghost small', text: 'Delete',
            onClick: () => confirmSheet({
              title: 'Delete this note?',
              message: 'It is gone for good — the person who sent it cannot see it or send it again.',
              confirmLabel: 'Delete',
              onConfirm: async () => {
                await feedback.remove(n.id);
                notes.splice(notes.indexOf(n), 1);
                draw();
                toast('Note deleted');
              },
            }),
          }),
        );
        return card;
      }),
    );
  };

  draw();

  return screenShell({
    title: 'Notes',
    sub: st.developer ? 'What people have sent in' : '',
    back: '#/account',
    scroll: body,
  });
}

export async function SignInView() {
  if (!auth.configured()) return AccountView();

  const state = await auth.state();
  const wasAnonymous = state.mode === 'cloud' && state.user && state.user.isAnonymous;
  const hasLocal = Object.values(await auth.localRowCounts()).reduce((n, v) => n + v, 0);

  const email = el('input', { class: 'input', type: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
  const password = el('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Password' });

  const signInBtn = el('button', {
    class: 'btn primary block',
    text: 'Sign in',
    onClick: async () => {
      const e = email.value.trim(), p = password.value;
      if (!e || !p) { toast('Enter your email and password'); return; }
      const ok = await run(signInBtn, 'Signing in…', async () => {
        await auth.signInEmail(e, p);
        toast('Signed in');
      });
      if (ok) go('#/account');
    },
  });

  const google = googleButton({
    label: 'Continue with Google',
    className: 'btn block',
    onDone: () => go('#/account'),
  });
  const googleBtn = google.btn;

  const resetBtn = el('button', {
    class: 'btn ghost block',
    text: 'Send a password reset email',
    onClick: async () => {
      const e = email.value.trim();
      if (!e) { toast('Enter your email first'); return; }
      await run(resetBtn, 'Sending…', async () => {
        await auth.sendPasswordReset(e);
        toast('Reset email sent');
      });
      resetBtn.disabled = false;
      resetBtn.textContent = 'Send a password reset email';
    },
  });

  return screenShell({
    title: 'Sign in',
    back: () => go('#/account'),
    scroll: [
      // Signing in to a DIFFERENT account switches uid, so anything logged
      // anonymously on this device stops being reachable. Say it before, not after.
      wasAnonymous && hasLocal
        ? el('div', { class: 'card' },
            el('div', { class: 'help-line' },
              el('div', { class: 'section-label', text: 'Before you sign in' }),
              helpDot('Go back and CREATE an account instead, and everything on this device comes '
                + 'with you automatically — there is nothing to press. Signing in is for an account '
                + 'that already exists somewhere else, and it has its own history.',
              { label: 'How to keep what is on this device' })),
            el('div', { class: 'field-help' },
              `This device has ${hasLocal} item${hasLocal === 1 ? '' : 's'} logged without an account. `
              + 'Signing in shows that account\'s data instead.'),
          )
        : null,

      el('div', { class: 'card' },
        el('div', { class: 'field' }, el('label', { text: 'Email' }), email),
        el('div', { class: 'field' }, el('label', { text: 'Password' }), password),
        signInBtn,
      ),

      el('div', { class: 'or-rule' }, el('span', { text: 'or' })),
      googleBtn,
      google.status,
      google.escape,
      resetBtn,
    ],
  });
}
