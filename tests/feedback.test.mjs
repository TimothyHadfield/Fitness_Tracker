// NOTES TO THE DEVELOPER — the pure half.
//   node tests/feedback.test.mjs
//
// No DOM, no store, no network. What is checked here is the SHAPE of a note and
// who counts as the developer; who may actually read one is `firestore.rules`
// and is checked by tests/rules.test.mjs, which runs as somebody who is not you.
//
// 🚨 THE LOAD-BEARING TEST IN THIS FILE IS THE LAST ONE: that the uid in
// js/feedback.js and the uid in firestore.rules are the same string. They are
// deliberately duplicated — one decides whether a screen is drawn, the other
// decides whether the database answers — and if they ever drift, the failure is
// silent in the worst direction: an inbox that renders and stays empty, or, far
// worse, a rule granting an account the app no longer shows the screen to.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const {
  buildNote, sortNotes, isDeveloper, DEVELOPER_UID, MAX_NOTE, MAX_NAME, MAX_PLATFORM,
} = await import('../js/feedback.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) fails++; };

const UID = 'user-1';
const NOW = '2026-09-04T10:00:00.000Z';
const good = (over = {}) => buildNote({ text: 'the rest timer is too loud', uid: UID, now: NOW, ...over });

/* ================= a note is built, or the reason is sayable ================= */
{
  const r = good();
  ok(r.ok, 'an ordinary note builds');
  ok(r.note.uid === UID && r.note.text === 'the rest timer is too loud',
     'carrying the sender and the words');
  ok(r.note.createdAt === NOW, 'and when');

  /* ⚠️ EVERY REFUSAL IS A SENTENCE, NOT A FALSE. Each of these is something the
     person can fix, and the screen has to be able to say which — "nothing
     happened" is the failure mode this app keeps writing warnings about. */
  const empty = buildNote({ text: '   ', uid: UID, now: NOW });
  ok(!empty.ok && /Write something/.test(empty.reason),
     `whitespace alone is refused, and says so (${empty.reason})`);
  ok(!buildNote({ text: 'hi', uid: null, now: NOW }).ok, 'a note with no sender is refused');
  ok(/signed in/.test(buildNote({ text: 'hi', uid: null, now: NOW }).reason),
     'and the reason names the fix rather than the rule');

  const over = buildNote({ text: 'x'.repeat(MAX_NOTE + 25), uid: UID, now: NOW });
  ok(!over.ok && /25 characters over/.test(over.reason),
     `too long says BY HOW MUCH (${over.reason}) — "too long" alone is a puzzle`);
  ok(buildNote({ text: 'x'.repeat(MAX_NOTE), uid: UID, now: NOW }).ok,
     'and exactly at the limit is fine — an off-by-one here refuses a valid note');

  // Trimmed, so a note that is only long because of trailing newlines is not
  // refused, and the stored text does not carry them.
  const padded = buildNote({ text: `  hello  \n`, uid: UID, now: NOW });
  ok(padded.ok && padded.note.text === 'hello', 'the text is trimmed');
}

/* ================= the shape is fixed, and the rule checks the same one ================= */
{
  const r = good({ name: 'Autumn', platform: 'iPhone' });
  ok(JSON.stringify(Object.keys(r.note).sort())
     === JSON.stringify(['createdAt', 'name', 'platform', 'text', 'uid']),
     `exactly five fields, always (${Object.keys(r.note).sort().join(', ')})`);

  const bare = good();
  ok(bare.note.name === '' && bare.note.platform === '',
     '⚠️ and the optional ones are EMPTY STRINGS rather than absent — the rule checks '
     + '`is string`, so a missing key would be refused on the wire and the note would vanish');

  ok(good({ name: 'x'.repeat(200) }).note.name.length === MAX_NAME, 'a long name is cut to the cap');
  ok(good({ platform: 'x'.repeat(500) }).note.platform.length === MAX_PLATFORM,
     'and so is a long user-agent string');
  ok(good({ name: 42 }).note.name === '' && good({ platform: {} }).note.platform === '',
     'anything that is not a string becomes one, rather than being written as itself');
}

/* ================= who the developer is ================= */
{
  ok(isDeveloper(DEVELOPER_UID), 'the developer uid is the developer');
  ok(!isDeveloper('somebody-else') && !isDeveloper(null) && !isDeveloper(undefined)
     && !isDeveloper('') && !isDeveloper({}),
     '⚠️ and nothing else is — including the empty string and a non-string, which is what a '
     + 'signed-out caller looks like');
  ok(DEVELOPER_UID.length > 20 && !/@/.test(DEVELOPER_UID),
     '🚨 it is a uid, not an email — an email depends on the provider and can be changed, '
     + `a uid is issued once (${DEVELOPER_UID})`);
}

/* ================= newest first, and tolerant ================= */
{
  const sorted = sortNotes([
    { id: 'b', createdAt: '2026-09-01T00:00:00.000Z' },
    { id: 'c' },
    { id: 'a', createdAt: '2026-09-03T00:00:00.000Z' },
  ]);
  ok(sorted.map((n) => n.id).join('') === 'abc', 'newest first, undated last');
  ok(sortNotes([]).length === 0 && sortNotes(null).length === 0 && sortNotes(undefined).length === 0,
     'and nothing in is nothing out rather than a throw');

  const input = [{ id: 'x', createdAt: '1' }];
  ok(sortNotes(input) !== input, 'the caller\'s array is not sorted in place');
}

/* ================= 🚨 THE TWO COPIES OF THE UID AGREE ================= */
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');

  ok(rules.includes(DEVELOPER_UID),
     `🚨 firestore.rules names the SAME developer uid as js/feedback.js (${DEVELOPER_UID})`);

  /* ⚠️ SCOPED TO THE FEEDBACK BLOCK, AND THE FIRST DRAFT WAS NOT — it searched
     the whole file and matched a `text.size() <= 500` belonging to comments,
     then reported the feedback cap as 500. A whole-file regex over a rules file
     will happily answer a question about the wrong collection, which is a worse
     failure than not checking at all: it reads as a confident disagreement. */
  const block = rules.slice(rules.indexOf('function validNote()'));
  const capOf = (field) => {
    const m = block.match(new RegExp(`data\\.${field}\\.size\\(\\) <= (\\d+)`));
    return m ? Number(m[1]) : null;
  };

  /* The client caps the text and the rule caps it again; if the rule's number
     were the SMALLER of the two, a note the app accepted and showed as sent
     would be refused on the wire — a write failing silently after the UI said
     it worked, which is the exact shape of bug this project keeps finding. */
  ok(capOf('text') === MAX_NOTE,
     `the rule's text cap matches MAX_NOTE (rule ${capOf('text')}, module ${MAX_NOTE})`);
  ok(capOf('name') === MAX_NAME, `and the name cap (rule ${capOf('name')}, module ${MAX_NAME})`);
  ok(capOf('platform') === MAX_PLATFORM,
     `and the platform cap (rule ${capOf('platform')}, module ${MAX_PLATFORM})`);

  // The field list in the rule has to be the field list the builder writes, or
  // a note is refused for carrying a key nobody removed.
  ok(/hasOnly\(\['uid', 'name', 'text', 'platform', 'createdAt'\]\)/.test(block),
     'and the rule shape-checks exactly the five fields buildNote() writes');

  ok(/allow update: if false;/.test(rules.slice(rules.indexOf('match /feedback/'))),
     '🛑 a note can never be edited, by anybody — it is a record of what somebody said');
}

console.log(fails ? `\n${fails} check(s) FAILED.` : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
