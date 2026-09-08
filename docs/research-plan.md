# Research section — the rebuild

What the Research tab is now, what it becomes, and the reasoning for every choice including
the ones rejected. Written 2026-09-07 after Tim asked for a plan covering structure,
reachability and whether the section should be entertaining.

Read `docs/direction.md` §4b first — it says Data answers **what your training MEANS**, and this
whole plan lives inside that sentence.

---

## 1. What is there today

Two things, in `renderResearchPane()` (`js/views-data.js`):

- **"The basics, and how sure anyone is"** — 11 topics from `js/research-topics.js`, each a
  `<details>`: question, confidence pill, lead, answer, 3+ points, a caveat, a source line.
- **"How strength changes with age"** — one SVG chart from `js/research-data.js` (Harbo 2012),
  with a legend, a tap readout and a data table.

The data model is already good and the plan keeps all of it:

| field | what it does |
|---|---|
| `question`, `lead`, `answer` | the topic, ≤45 words on the answer |
| `points[]` | 3+ specifics, each with `sources[]`, some with `myth` |
| `caveat` | the topic's own weak spot — mandatory, >40 chars |
| `confidence` | `strong` / `good` / `limited`, shown as a pill, dashed border when limited |
| `SOURCES` | 27 sources defined once, each with `n` and a `url` |

Held by `tests/data-layer.test.mjs`: unique ids, seven ids Tim asked for by name, every point
cites a defined source, every topic admits a limit, 45 words an answer, 260 a topic.

**None of that is the problem.** The problems are that there are only eleven topics, that
nothing connects them to the reader, that the confidence field does no work beyond being
printed, and that a flat list of eleven has no way to grow to fifty.

---

## 2. What it becomes

**A flat, filterable list that grows into sections only when a section is earned.**

The rejected alternative is the obvious one, and it is worth writing down because it was my own
first answer: a nine-section, ninety-leaf tree — Foundations / Training variables / Exercise
selection / Technique / Recovery / Nutrition / Reading the evidence / Disagreements / Myths, each
three levels deep. It is a good **content plan** and a bad **screen**:

- three taps to reach one paragraph on a 360px phone;
- it forces one axis when readers want two — "how do I train chest" and "how many sets" are both
  legitimate entry points and a tree makes you pick;
- "Where the evidence disagrees" duplicates every topic it contains, so nothing has one home;
- branches are wildly uneven — Volume is a chapter, Time of day is a paragraph;
- and it is **ninety slots for eleven topics**, which is mostly empty rooms.

So the tree survives as §6, the writing backlog. The screen gets this instead:

1. **Facets, not branches.** Each topic gains a `section`, a `tags[]` and a `contested` flag.
   "Chest" becomes a filter, not a location — which dissolves the muscle-vs-variable problem,
   because both are one tap from the same list.
2. **Confidence becomes usable.** It is a field today and pure decoration. It becomes a filter.
3. **A hook per topic.** One arresting true sentence, under the question, in the collapsed row.
4. **Contested is a badge**, not a section. Same content, one home.
5. **Sections appear only once they are earned.** Below that a header is a label on a list of two.
   ⚠️ The threshold written here first was "eight topics in that section" and it was wrong — see
   §3a for what replaced it and why.

### 2.1 The hook, and the rule that keeps it honest

Tim asked whether the section should be entertaining, in the way a thumbnail is. The answer is
yes to attention and no to clickbait, and the line between them is this:

> **A hook may be as loud as it likes about WHAT the finding is. It may never overstate HOW SURE
> anyone is.**

That is Design Rule 9's shape applied to headlines. It is not a stylistic preference — this
folder's own research library is substantially a catalogue of what happens when fitness content
breaks that rule: ISSN position stands whose headline is firmer than the review above it, a video
titled "11 Studies" resting on two, "one third faster muscle growth" that is a relabelled effect
size of 0.11. A research section using those techniques would be doing the thing it exists to
criticise.

The supply of honest hooks is large because the findings are genuinely surprising: stretching does
not reduce injury risk; the pump does not predict growth; an identical heat stimulus rates 4 out of
100 for one person and 100 for another; 47% of lifters given their own "10-rep" weight and told to
go to failure got 16 or more.

**Rejected: a thumbnail per topic.** Art costs money Tim has not spent — `sw.js`'s exercise-image
block is still empty pending it — and generic stock imagery is exactly what makes an app read as
AI-generated, which he has already named as the thing needing a human eye. A sentence with a
number in it out-pulls a stock photo here anyway.

### 2.2 What the screen looks like

```
The basics, and how sure anyone is                      [?]
[ All ] [ Strong ] [ Good ] [ Limited ]        ← confidence chips
[ All ] [ Contested ]                          ← contested chip, only if any exist

▸ How many sets, and how many reps        Strong evidence
    Past ~19 sets a week you pay ten sets for each further gain
▸ Should every set go to failure?          Good evidence  ⚡contested
    Half the lifters who think they are near failure have six reps left
```

The hook is the second line of the collapsed row. Everything else is unchanged inside.

---

## 3. Data model changes

All in `js/research-topics.js`, all additive — no existing field changes meaning, so every current
assertion still holds.

```js
{
  id, question, lead, answer, points, caveat, confidence,   // unchanged

  hook: 'Half of them had six reps left in the tank.',      // NEW, required, ≤ 14 words
  section: 'how-to-train',                                  // NEW, required, one of five
  tags: ['effort', 'volume'],                               // NEW, required, ≥ 1
  contested: {                                              // NEW, optional
    what: 'How close to failure sets need to be',
    verdict: '1–3 reps short matches failure at normal volumes',
    confidence: 'strong',
  },
}
```

**Five sections**, and no more, because five fits a phone and nine does not:

| id | label |
|---|---|
| `how-it-works` | How it works |
| `how-to-train` | How to train |
| `what-to-do` | What to do |
| `recovery-and-food` | Recovery and food |
| `judging-evidence` | Judging the evidence |

**Tags** are a controlled vocabulary exported as `TAGS`, not free text, because free-text tags
drift into synonyms within a month. Two families: variables (`volume`, `effort`, `load`,
`frequency`, `range-of-motion`, `tempo`, `rest`, `progression`, `periodisation`) and muscles
(`chest`, `back`, `shoulders`, `arms`, `legs`, `core`). A topic may carry both.

---

## 3a. ✅ BUILT, 2026-09-07 — phases 1 and 2

**19 topics, 61 sources, 5 contested.** Sections: How it works 4 · How to train 8 · What to do 2 ·
Recovery and food 3 · Judging the evidence 2.

Eight topics were added from the library, in the gaps §6 named: `range-of-motion`,
`tempo-and-tension`, `periodisation-and-deloads`, `time-off-and-muscle-memory`,
`picking-exercises`, `how-muscle-grows`, `reading-a-study`, `why-people-differ`. Every one carries
a caveat written before its answer, and 34 new sources each with an `n` and a URL copied from a
resolved link in the research library rather than constructed.

**One rule in this plan turned out to be wrong and was changed while building it.** §2 said a
section appears once it holds eight topics. That read well and broke on contact: "How to train"
reached eight while three other sections held two or three, so the rule would have drawn *one*
heading with eleven topics loose underneath it. A heading over part of a list is worse than none.
The threshold is now about the list, not the section — **the whole list groups at 16 topics, or
none of it does.** It is in `topicList()` in `js/views-data.js` with the reasoning beside it.

Two things the drafting agents flagged and a human resolved: `reading-a-study` and
`why-people-differ` had been tagged `volume` because neither is about a training variable — both
are now `method`, which was already in the vocabulary. And `picking-exercises` lost a `legs` tag it
had never earned.

`tests/research-pane.test.mjs` is new and covers the behaviour a data-layer test cannot reach —
that the chips filter, that a group heading does not outlive its own topics, and that no filter
combination lands on a blank pane.

## 4. Build order

**Phase 1 — the model and the screen. ✅ DONE.** Add the fields to the 11 existing topics, add `SECTIONS`
and `TAGS`, extend the tests, add the filter chips and the hook line to the render. No new content.
Ships a better version of what exists.

**Phase 2 — content. ✅ DONE, eight topics.** New topics in the gaps, written from the research library. Detail in §6.

**Phase 3 — the reader's own numbers.** One line per topic comparing the reader to the band, for
the topics where a number is measurable. `weeklyVolumeByMuscle()` already exists.
⚠️ `research-topics.js` stays **pure** — the view computes the line, the module never sees a store.

**Phase 4 — figures.** `figureNote()` already exists. Needs the figure pipeline run over ISSN and
House of Hypertrophy first; see §7.

---

## 5. Positives and negatives, honestly

**What this gains**

- The confidence field starts doing work instead of being printed.
- Two entry points to one body of content, without duplicating anything.
- A structure that scales to fifty topics without a redesign.
- Hooks make the section worth opening, which a research tab nobody opens is not.
- The contested badge is a genuine differentiator: no other lifting app shows you a disagreement
  and then says who is right.

**What could go wrong, and what stops it**

| risk | mitigation |
|---|---|
| **Hooks drift into overclaiming.** The single failure that would cost real credibility. | A test: a hook on a `limited` topic may not contain certainty words (`proven`, `always`, `never`, `must`). Reviewed per topic. |
| **Compression drops a caveat.** Library prose is dense; the budget is 45/260 words. The Goals screen has already lost the words "not a measured fact" this way once. | The caveat field is mandatory and asserted >40 chars. New topics get their caveat written *first*, before the answer. |
| **Dilution — 25 thin topics are worse than 11 good ones.** | New topics only where the library is strong AND the app is silent. Explicitly not volume or rest, where the app's Pelland/ACSM sourcing is *newer* than the library. |
| **Filter chips add clutter on a 360px screen.** | Chips render only when they would do something — the contested row is absent if nothing is contested. Section headers appear at 8 topics, not before. |
| **More topics is more to keep current.** | Retraction tooling exists in `Fitness_Research/tools/`; §7 makes it a standing job rather than a one-off. |
| **This is a visual change, and Tim's standing rule is that visuals are never touched unprompted.** | He prompted this one explicitly. Restraint still applies: chips reuse the existing `.chip` class, the hook reuses `.field-help`, and no existing pixel moves without a reason written here. |
| **The tag vocabulary rots.** | `TAGS` is a closed set and a test rejects any tag not in it. |

**What this deliberately does not do**

- No injury or rehab content. The library's clinical source is unopposed in it, its rehab dosing is
  largely uncited expert opinion, and medical guidance to strangers is a different liability class.
- No nutrition expansion yet — `direction.md` puts diet after exercise in scope order.
- No search. Below about 30 topics it is not worth the code; the threshold is written into §6 so
  the next person knows when it becomes worth it.

---

## 6. The content backlog — the tree, kept as a plan

The nine-section tree is the writing plan. A branch becomes a `section` on screen when it reaches
eight topics; until then its topics live in the flat list with their tags.

```
Foundations              → section: how-it-works
    How muscle grows · mechanical tension · metabolic stress · muscle damage · hormones
    · fibre types · satellite cells and myonuclei
    How strength grows · neural vs muscular · strength and size as separate goals
    What depends on who you are · age · sex · training history · individual response

Training variables       → section: how-to-train
    Volume · sets per week · sets per session · the minimum that works · what counts as a set
    Effort · how close to failure · past failure · judging reps in reserve
    Load and reps · the rep range · how light is too light · heavy vs light at matched effort
    Frequency
    Range of motion · full vs partial · lengthened partials · long muscle lengths
    Tempo · rep speed · eccentrics · time under tension
    Rest between sets
    Progression · adding weight · double progression · stalling
    Periodisation · deloads · blocks and waves · time off and detraining · muscle memory

Exercise selection       → section: what-to-do
    Principles · "best exercise" is the wrong question · muscle length and leverage
    · two-joint muscles in compounds · compounds vs isolation · free weights vs machines
    · changing exercises
    By muscle · chest · back · shoulders · biceps · triceps · forearms · quads · hamstrings
    · glutes · calves · core · neck
    What "targets a muscle" means · measured growth · activation · anatomy

Technique                → section: what-to-do
    Per lift · cues that hold up · common errors
    Equipment · belts · straps · sleeves · shoes · grip

Recovery and lifestyle   → section: recovery-and-food
    Sleep · stress · soreness · warm-ups · stretching · cardio and interference · time of day

Nutrition                → section: recovery-and-food   (deferred, scope order)
    Energy balance · protein · carbs and fat · meal timing · supplements · gaining and losing

Reading the evidence     → section: judging-evidence
    How to read a study · what the numbers mean · why studies disagree · traps
```

**Phase 2 writes eight of these**, chosen because the library is strong there and the app is
silent: range of motion and lengthened partials · tempo and time under tension · exercise
selection principles · periodisation and deloads · detraining and muscle memory · what makes a
muscle grow · how to read a study · why two people get different results.

---

## 7. What the research folder still owes this

- **`claims.json`** — a machine-readable layer over the library's 110,000 words of prose. Without
  it every content pass means an agent re-reading markdown. This is the single biggest unblocker.
- **The 20 verdicts from `WHAT-TO-BELIEVE.md`, structured** — feeds `contested` directly.
- **Figures for the other four sources**, ISSN first. Nippard's 108 figure papers are Nippard's
  citations and skew to Nippard's topics, which is why Phase 4 is blocked: the new topics have thin
  figure coverage.
- **A confidence mapping, decided once.** The library grades High/Moderate/Low;
  the app grades strong/good/limited. Two scales for one claim will drift.
- **The retraction audit run over the app's own citations**, as a standing job.
