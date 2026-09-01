// A NOTE TO THE DEVELOPER — pure. No DOM, no store, no clock.
//
// Tim, 2026-09-04: *"adding a temporary section to the app that allows the user
// to write a note or idea straight to the developer (me) would be nice to have.
// Then, make my account (timhadfield7@gmail.com) a developer account where I can
// read all these notes or ideas straight on the app."*
//
// ── WHY IT EXISTS, WHICH DECIDES WHEN IT LEAVES ─────────────────────────────
//
// It is DELIBERATELY TEMPORARY. The app is about to be put in front of people
// for the first time, and the one thing that cannot be recovered later is what a
// new user thought before they got used to it. This is a channel for that, not a
// support desk — there is no thread, no reply, no status. ⚠️ **When the first
// users stop being new, this feature has done its job and should come out**;
// leaving it in turns it into a support inbox nobody is staffing.
//
// ── THE PART THAT IS NOT A FORM ─────────────────────────────────────────────
//
// 🚨 A NOTE IS SOMEBODY ELSE'S WORDS ABOUT THEIR OWN TRAINING, AND EXACTLY ONE
// PERSON MAY READ IT. That is enforced in `firestore.rules` against a hard-coded
// uid — not by hiding a screen, and not by a flag in a settings document that
// the owner of the document could edit. A reader who is not the developer is
// refused on the wire.
//
// ⚠️ AND IT IS THE FIRST FREE TEXT THIS APP HAS EVER STORED FROM ONE PERSON FOR
// ANOTHER TO READ. Everything social so far is a projection of training the
// sender chose to publish; a note is prose, aimed at a human. That is the
// moderation surface Tim parked on 2026-09-04 (*"just put it in the notes"*),
// and the two things that keep it small are here rather than left to the screen:
// only the developer can read, and nobody can read anybody else's.

/** Longest note we will store. */
export const MAX_NOTE = 1000;

/** Longest sender name we will copy alongside it. */
export const MAX_NAME = 60;

/** Longest device description. A user-agent string is mostly noise past this. */
export const MAX_PLATFORM = 120;

/**
 * 🚨 THE DEVELOPER, BY uid, AND IT IS A uid ON PURPOSE.
 *
 * ⚠️ NOT AN EMAIL. `request.auth.token.email` is available in a rule and would
 * read better here, but it is only as good as the provider that filled it in and
 * it can change — a Google account's primary address can be edited, and an
 * unverified email is a claim rather than a fact. A uid is issued by Firebase
 * Auth, is immutable, and is the same thing every other rule in this project
 * keys on (`isOwner`, `isFriendOf`, the invite and request ids).
 *
 * ⚠️ NOT A FLAG IN A DOCUMENT EITHER. "developer: true" in a settings document
 * is a permission the holder of the document can grant themselves.
 *
 * This is Tim's account — timhadfield7@gmail.com, the Google sign-in on the live
 * project. ⚠️ **It is duplicated in `firestore.rules` and the two must agree**;
 * the rules file is the one that actually protects anything, and there is a test
 * asserting they match, because a screen that hides itself while the database
 * answers anybody is the worst version of this feature.
 */
export const DEVELOPER_UID = '0WQLOAaP8DaRCTDMBSBbRM9haJq2';

/** Is this uid the developer? */
export function isDeveloper(uid) {
  return typeof uid === 'string' && uid === DEVELOPER_UID;
}

/**
 * Turn typed text into a note, or say why not.
 *
 * ⚠️ IT RETURNS A REASON RATHER THAN THROWING OR RETURNING NULL, because every
 * refusal here is something the person can fix and the screen has to be able to
 * tell them which. "Nothing happened" is the failure mode this app writes
 * warnings about.
 *
 * @returns {{ok: true, note: object} | {ok: false, reason: string}}
 */
export function buildNote({ text, uid, name, now, platform }) {
  if (!uid || typeof uid !== 'string') {
    return { ok: false, reason: 'You need to be signed in to send a note.' };
  }
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body) {
    return { ok: false, reason: 'Write something first.' };
  }
  if (body.length > MAX_NOTE) {
    // Says the number, and by how much. "Too long" without either is a puzzle.
    return {
      ok: false,
      reason: `That is ${body.length - MAX_NOTE} characters over the ${MAX_NOTE} limit.`,
    };
  }

  /* ⚠️ EVERY FIELD IS NAMED HERE AND THE RULE CHECKS THE SAME LIST. A document
   * built by spreading whatever the caller passed is a document that grows a
   * field nobody audited — the argument above the `directory` block, which is
   * why that one is shape-checked too. Adding a field means changing this
   * object, the rule, and the test that compares them. */
  return {
    ok: true,
    note: {
      uid,
      // ⚠️ A COPY OF THE NAME, TAKEN NOW, and this is the one place in the app
      // that stores somebody's display name outside their own subtree. It is
      // here because a note without a sender is a note that cannot be answered,
      // and the alternative — resolving the uid against the directory at read
      // time — fails for anybody who has since turned "findable by name" off.
      // It goes stale if they rename themselves, which is the right trade for a
      // channel that exists for a couple of months.
      name: typeof name === 'string' ? name.slice(0, MAX_NAME) : '',
      text: body,
      /* ⚠️ THE DEVICE, NOT THE BUILD, AND THE DIFFERENCE IS THE POINT. The
       * obvious field here is an app version — and this app has no build step,
       * so any version string would be a constant that never changed while
       * looking exactly like something that did. That is worse than nothing: it
       * would answer "were they on the old build?" with a confident wrong yes.
       *
       * What IS knowable is what they were running it on, and that happens to be
       * the first real question about any bug report — "iPhone or laptop?".
       * Trimmed hard, because a full user-agent string is mostly noise. */
      platform: typeof platform === 'string' ? platform.slice(0, MAX_PLATFORM) : '',
      createdAt: typeof now === 'string' ? now : '',
    },
  };
}

/**
 * Newest first, and tolerant of a missing date.
 *
 * ⚠️ Sorted HERE rather than in the query. A Firestore `orderBy` on a collection
 * this small buys nothing and costs an index that would have to exist before the
 * first read works — and an index missing in production presents as an empty
 * inbox rather than as an error.
 */
export function sortNotes(notes) {
  return [...(notes || [])].sort((a, b) =>
    String((b && b.createdAt) || '').localeCompare(String((a && a.createdAt) || '')));
}
