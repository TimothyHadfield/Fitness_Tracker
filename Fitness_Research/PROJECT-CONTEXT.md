# Project context — read this first

A handoff note for a fresh chat. What this folder is, where it stands, what is left, and the
lessons worth carrying into any further work.

**The build is finished.** Five sources, 781 notes, **6,139 unique PubMed-indexed papers** across
the per-source bibliographies, a cross-source adjudication layer and a retraction audit. Nothing
is half-done. If you have been dropped in here with no instructions, read this file and then stop
— there is no work in progress to resume.

---

## Before you commit anything — this folder shares a git repo with Tim's app

`Fitness_Research/` is nested inside `Fitness_Tracker/`, and **one git repo covers both.** The
parent folder is a live web app Tim actively works on, often in a second Claude session at the
same time, so the working tree will usually contain app changes that are not yours.

**Never `git add -A` or `git commit -a`. Stage only `Fitness_Research/` paths explicitly.**
Sweeping the app's half-finished files into a research commit is the easy mistake here.

Two refinements learned the hard way:

- **`git add Fitness_Research/` is not precise enough.** It sweeps up
  `Fitness_Research/weightlifting.md`, an empty untracked file Tim has never asked about. Name
  paths more precisely, or check `git status --short` before committing.
- **Sub-agents sometimes commit and push on their own** even when not asked. They have staged
  correctly so far, but do not rely on it. After any run where agents might have committed:
  `git diff --name-only <base>..HEAD | grep -v Fitness_Research/` should come back empty.

If you hit an `index.lock` error, the other session is mid-commit. Wait and retry; don't delete
the lock file.

---

## What is in here

[README.md](README.md) is the top-level index. Start a reader at
[WHAT-TO-BELIEVE.md](WHAT-TO-BELIEVE.md), and start *yourself* at
[TOPIC-MAP.md](TOPIC-MAP.md) — it routes a question to the file that answers it.

| Source | Notes | Bibliography | What it is |
| --- | --- | --- | --- |
| `Jeff Nippard videos/` | 279 | 2,075 refs | The broadest: training, nutrition, technique, myths. Groups his citations under his own topic headings, which is the best claim-to-source mapping any video source gives. |
| `ISSN position stands/` | 27 | 5,192 refs | Formal expert-body consensus documents. Cheapest and highest-quality corpus in the library. |
| `Menno Henselmans videos/` | 151 | 535 refs | A coach who argues against the consensus more often than he agrees with it. The value is the disagreement. |
| `House of Hypertrophy videos/` | 169 | 745 refs | The most densely cited channel. Hypertrophy mechanisms and single variables in depth. |
| `Barbell Medicine articles/` | 155 | 2,171 refs | Practising physicians and physiotherapists. The only clinical source, and the only one covering injury, pain and medicine. |

Every source folder has the same shape: `SUMMARY.md` (read this first), `README.md` (index of
every note, generated), `RESEARCH-CITATIONS.md` (bibliography, generated), and the notes.

`Jeff Nippard videos/` additionally has **`FIGURES.md`** and **`figures/`** — the figures from the
open-access papers his notes cite, paired back to the notes, with 392 images stored under a CC
licence and the rest linked. No other source has them yet; the pipeline is one command per source.

The three largest sources are also split into **domain summaries**, `SUMMARY-<domain>.md`, each
written from every note in its area and carrying the sample sizes, designs and effect sizes that
the top-layer `SUMMARY.md` deliberately does not. Nippard has 6, House of Hypertrophy 8, Barbell
Medicine 6. The pattern to copy if you add a source is `Jeff Nippard videos/SUMMARY-technique.md`.
ISSN and Menno are short enough not to need the split.

Four files sit above the sources:

- **[TOPIC-MAP.md](TOPIC-MAP.md)** — the router. A question maps to the files that answer it, in
  order. Also records which notes are filed somewhere a reader would not look.

- **[WHAT-TO-BELIEVE.md](WHAT-TO-BELIEVE.md)** — the arbiter. Where two sources disagree it says
  which is right, why they differ, and how confident that deserves to be. Opens with 20 verdicts
  in one table. This is the thing that makes it a library rather than five folders.
- **[RETRACTION-AUDIT.md](RETRACTION-AUDIT.md)** — every PubMed ID the library cites, checked.
  6,139 of 6,139 returned a record; three are retracted and all three are now flagged in place.
- **[README.md](README.md)** — the index.

Working material lives in `sources/<slug>/`: the agent brief, the assignment table, the extracted
references, the resolved citations, and the hand-written intro and summary parts. **Keep these.**
A summary can be reassembled from `summary-parts/` without re-running the agents.

`transcripts/` is gitignored — fetched captions and articles, rebuildable.

---

## What is left

In rough order of value. None of it is urgent and none of it blocks anything.

1. **Squat University**, which Tim asked for as a later pass. Best subject-matter fit for injury
   and rehab, and it would give the clinical material the second opinion it currently lacks —
   Barbell Medicine is unopposed in this library, which the cross-source layer flags as its
   weakest structural point. Caveat from the original probe: its citation discipline decayed
   sharply after about 2019.
2. **Retrofit the House of Hypertrophy notes' reference sections.** They were written against a
   `refs.json` that was missing 69 citations, found and fixed afterwards. The bibliography and
   index use the corrected data; roughly 35 notes still omit a link their video actually gave.
   Mostly congress abstracts and unindexed PDFs that would enter as bare links anyway. Cheap
   agent pass.
3. **Fix the defects the cross-source layer found**, listed at the bottom of
   [WHAT-TO-BELIEVE.md](WHAT-TO-BELIEVE.md): the Wolf lengthened-partials trial written up with
   two different sample sizes, Maeo's triceps study dated two different years, and Chaves 2020
   read three incompatible ways by three sources.

   The domain-summary pass located several of these precisely and found more. All are reference
   hygiene — none changes a conclusion — and all are cheap one-line fixes:
   - **Wolf** is **n=25** in `finally-here-new-study-muscle-growth-epic.md` and
     `training-beyond-failure-new-study-epic.md`, but "30 trained lifters" in
     `full-range-motion-not-optimal-building-muscle.md`.
   - **Costa 2021** is described four ways across the HoH biceps and triceps notes — 22 detrained
     men, 22 trained men over nine weeks, 22 people over eight weeks, trained men over eight
     weeks. The trained/detrained conflict is unflagged and that study is the main variety
     evidence in both arms.
   - **Enes 2021** is 28 trained men in one note, 18 in another. **Ahtiainen 2005** carries two
     different PMIDs across three notes. A **Schoenfeld** repetition-duration meta-analysis is
     dated 2015 in one note and 2016 in another. The **Schoenfeld 2020 calf trial** is 8 weeks in
     one note and 10 in another (8 is correct).
   - **Gentil 2015** is used at face value in a 2022 HoH note and discounted in a 2024 one for its
     author's statistical anomalies. Both stand; neither mentions the other.
   - In Barbell Medicine, **Larsen 2021** is resolved in one note and recorded as unresolvable in
     another.

4. **Fix the Barbell Medicine boilerplate errors as one job, not eight.** Biressi 2007, a
   developmental biology paper, is attached to the same unsupported training-dose claim in at
   least four articles, and a near-verbatim "osteoarthritis progression is slowed or completely
   stopped" sentence appears in at least four. These are reused house text, so they are one fix.

5. **Cross-link the recoverable author names in the 26 unreferenced HoH videos.** Several names
   currently marked "unverified, from auto-captions" are recoverable from adjacent verified
   reference lists — MacDougall 1982, Meijer 2015, Haun 2019, Yu 2013, Dankel 2016 and
   Madarame 2018 were all identified this way. A single agent pass over the seven worst notes
   would resolve a good fraction of the "do not cite" entries.

6. **Label the species in the HoH mechanisms material.** The 87-study mechanics video — one of the
   unreferenced ones, and the channel's intellectual centre — never gives a species for its four
   load-bearing mechanical-tension studies, at least one of which is a rat mTORC1 dose-response
   experiment. A reader assumes human work. This is the single most consequential gap the
   domain pass found.

7. **Add the soleus clash to the arbiter.** Nippard prescribes 15–25-rep calf sets on fibre-type
   grounds; House of Hypertrophy's position rests on a calf trial finding no fibre-type effect.
   Neither engages the other and [WHAT-TO-BELIEVE.md](WHAT-TO-BELIEVE.md) does not yet cover it.
8. **Run the figure pipeline over the other four sources.** Only Jeff Nippard has figures so far.
   One command each — `python tools/fetch_figures.py "<source>"` then `build_figure_index.py
   "<source>" --annotate-notes` — and each source's `RESEARCH-CITATIONS.md` already has the
   note-to-PMID mapping the tool needs. Expect roughly the Nippard hit rate: about 30% of cited
   papers are in PMC, half of those return a figure list, and about 80% of *those* are openly
   licensed. ISSN is the obvious next one — its 5,192 references are mostly journal articles, so
   the yield should be far higher than a video source's, and its notes are the ones where a
   funding or forest plot would carry the most weight. Watch the total size: Nippard alone is
   35 MB, and this repo is public and served by GitHub Pages.

9. **The Nippard "Known problems in this library" list** at the bottom of
   `Jeff Nippard videos/SUMMARY.md` — a citation that doesn't support its claim (Farina 2010 in
   the cable kickback note), several misleading filenames, one study rendered with three different
   effect sizes, and caption-garbled researcher names still marked uncertain.
10. **Re-run the retraction audit periodically.** Retractions arrive years after publication, so a
   clean result is not permanent. Command is in [RETRACTION-AUDIT.md](RETRACTION-AUDIT.md).
11. **19 Nippard videos have no usable English captions** and were never written up. Listed at the
   bottom of this file. Injury recovery and posture are the two worth chasing elsewhere.

---

## The pipeline as it actually is

Everything in `tools/`. Paths are relative; run from `Fitness_Research/`.

**Fetch** — one of:
- `fetch_channel.py <channel-url> <outdir>` — YouTube. Catalogue and fetch in one resumable pass,
  saving the **description alongside every transcript** (one yt-dlp call gets both). Re-run with
  `--delay 6` to sweep up failures.
- `fetch_articles.py <sitemap-or-index-url> <outdir>` — HTML articles. Resumable, polite delay,
  extracts main content to markdown and **preserves inline reference markers**. Has `--refresh`.
- `fetch_issn.py` — PMC full text, plus `fetch_issn_disclosures.py` for the funding statements,
  which live in `<back>` and are easy to miss.

**Extract references** — one of:
- `extract_refs_desc.py <descdir> <out.json> [--expand shortlinks.json]` — video descriptions.
- `extract_refs_article.py <articledir> <out.json>` — inline `[n]` markers against a numbered
  list, **recording each marker with the sentence it sat on**, and verifying the numbering.

**Resolve** — `resolve_refs.py <refs.json> <citations.json>`. PubMed IDs, PMC IDs, DOIs and
ResearchGate slugs. Reuses anything already resolved; pass `--fresh` to force a full pass.

**Assign** — `make_assignments.py` / `make_assignments_article.py` produce the
`slug → filename → length → refcount → title` table. Never let agents pick their own filenames.

**Build** — after the notes are written:
- `build_channel_bibliography.py <sourcedir> <notesdir> <title>`
- `build_channel_readme.py <sourcedir> <notesdir> <intro.md> [topic-set]` — partitions on each
  note's own `**Topic:**` line, so the index cannot drift from the notes. Topic vocabularies live
  in the script; add a new one for a source whose domains differ.

**Audit** — `check_retractions.py <out.json> <paths...>` and `screen_reference_mismatch.py`.

**Figures** — `fetch_figures.py <sourcedir>` then `build_figure_index.py <sourcedir>
--annotate-notes`. Walks note → PMID → PMCID → licence → figure list → image files, and pairs the
result back to the notes in `FIGURES.md`. Both are resumable.

Four things learned building it, all of which cost time:

- **The PMC OA web service is gone.** `pmc/utils/oa/oa.fcgi` returns 404 for everything now, and
  the direct image path `pmc.ncbi.nlm.nih.gov/articles/PMCxxxx/bin/<file>` is blocked too. The
  route that works is NCBI `efetch?db=pmc` for the article XML, then **Europe PMC's
  `supplementaryFiles` endpoint**, which returns every image for an article in one zip.
- **efetch covers more articles than Europe PMC's `fullTextXML`.** Some free-to-read articles
  outside the OA subset still return full text with figures from efetch and nothing from Europe
  PMC. Try efetch first; a probe using only Europe PMC found figures for 1 article in 12, and the
  real number is closer to 6 in 10.
- **Match a licence pattern against both spellings.** Europe PMC reports `cc by`; the article's own
  XML gives a `creativecommons.org/licenses/...` URL. A regex for one silently drops the other,
  and the failure looks like "this paper just isn't open" rather than like a bug.
- **PubMed IDs come back as ints from one service and strings from another.** Pairing notes to
  articles silently produced zero matches until both sides were cast to `str`.

Older scripts (`fetch_transcript.py`, `extract_refs.py`, `resolve_pmids.py`,
`resolve_pmc_and_doi.py`, `build_references.py`, `build_menno_readme.py`) are the first-generation
versions kept for reference. Prefer the generalised ones above.

---

## Lessons

### Working with agents at scale

- **An agent's work exists only once it writes its file.** Two House of Hypertrophy runs were lost
  wholesale — one to a network outage, one to the session exiting during an interrupt — because
  dozens of agents were mid-task. Nothing partial survives.
- **Small batches, and commit as they land.** The run that worked used 3–5 notes per agent instead
  of 6+. First files landed in about three minutes; 24 notes were committed before the slowest
  agent finished reading its brief. This is the whole lesson and it is cheap.
- **The concurrency cap is 20** (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`). Over-cap launches fail
  immediately with an error per agent and an instruction not to retry. Feed batches in as slots
  free.
- **End with mop-up agents that compute their own worklist.** Give them the "what is missing"
  command, tell them to re-run it before every note and never overwrite, and point different
  agents at different ends of the list. Collisions still happen, but they replace a complete note
  with another complete note — wasted work, not lost work.
- **Never put a note in a numbered batch and also in the mop-up pool.** That is how
  `beginner-prescription.md` got written twice.
- **Give an explicit input → output filename mapping.** Agents choosing filenames produces
  collisions and inconsistency.
- **The instruction that mattered most: "under-linking is much better than a wrong attribution."**
  Agents honoured it and left claims unlinked rather than guessing between two plausible papers.
- **Tell them to skip a bad transcript and say so** rather than produce something.
- **Read the agent reports.** Every significant bug in the extraction pipeline was found because
  an agent said "this video reports zero references but its description clearly has some." Agents
  also caught the mismatched reference lists, the horse-anatomy citation, and a "Big Three
  Roundtable" that is about three guest lifters rather than squat/bench/deadlift.
- **Build summaries domain by domain, then assemble.** An agent asked to summarise 169 notes
  produces mush; one asked to summarise 26 notes on a single subject produces something with
  numbers in it. Keep the parts; assemble with hand-written front and back matter.
- **Run a coverage check on any assembled summary** — every link resolves, and every note is cited
  at least once. Both HoH and Barbell Medicine had notes no agent mentioned, folded in by hand
  afterwards. A note nobody mentions is a note nobody read.

### Getting the citations right

This is where nearly all the real bugs were, and they are all silent.

- **A source that reports zero references is a bug report, not a fact.** Check the raw description
  or article by hand before believing it.
- **Host allowlists under-count.** Widened repeatedly for Elsevier resolver URLs, ECSS congress
  abstracts, J-Stage, university thesis repositories, and papers rehosted as PDFs on private
  domains. Widen it again rather than accepting the loss.
- **Shorteners hide real papers.** All ten `bit.ly` links in the HoH descriptions were genuine
  citations. Resolve them once, offline, into a `shortlinks.json` and expand before filtering.
- **Punctuation matters more than it should.** A heading regex demanding a colon missed
  `References;` with a semicolon and cost 17 citations. A URL regex excluding `)` truncated every
  Lancet and Elsevier DOI — `10.1016/S0140-6736(18)30480-X` became `.../S0140-6736(18)` and then
  failed to resolve for no visible reason. Parens are now kept and trimmed only where unbalanced.
- **Some sources cite without any heading at all**, dropping the list under the timestamps. A line
  carrying both an author name and a scientific URL is a safe promotion signal — music credits and
  affiliate links never name an author.
- **Verify marker-to-reference mappings per document.** In the 2023 ISSN energy-drinks stand the
  offset drifts by up to three, so `[135]` is not reference 135. A max-marker-versus-count check
  catches it in seconds.
- **A verified mapping proves the numbering is consistent, not that the right paper was cited.**
  This is the single most important thing the Barbell Medicine pass taught. Claim-level checking
  found a hypertrophy claim citing a ketogenic-diet review, a biceps claim citing a study of the
  horse, a bone-density claim on a two-person case study, and printed PMIDs resolving to a
  fruit-juice titration paper and to polyolefin nanofibers.
- **Where a source prints both a number and an inline link, the link has been right and the number
  wrong, every time.** Prefer the link and flag the discrepancy.
- **Distinguish "the numbering is broken" from "there is no numbering."** `numbered` +
  `verified: false` means drift; `inline-links` or `lumped` with zero markers means the source
  never numbered anything; `none` means it cites nothing. Saying the wrong one is an error in the
  note.

### Resolving citations

- **PubMed** — NCBI esummary, batches of 150, no API key needed at this volume. NCBI answers 429
  readily; back off and retry rather than assuming a missing record.
- **PMC IDs** — NCBI ID converter → PMID → esummary.
- **DOIs** — Crossref. Free, no key. Include a mailto in the User-Agent.
- **ResearchGate returns 403 to everything.** Its URLs carry the paper title in the slug, so search
  PubMed by title and *verify* the returned title matches. The Wayback CDX index has the slug for
  bare RG IDs.
- **Title matching needs a high floor.** At 0.80 similarity, formulaic titles mis-match — a
  resistance-training review resolved to a balance-training review by the same authors. Typed
  citations now need the title verbatim, or ≥0.93 plus first-author corroboration.
- **Some journals aren't indexed anywhere machine-readable** (LWW, most strength-and-conditioning
  titles). Accept the bare link; it is worth more than a guess.

### Bad data — check for it, it is there

- **Creators paste the wrong reference list.** Three of 279 Nippard videos. Flag in place rather
  than deleting; the reader needs to know the sources don't support the claims.
- **A malformed URL can resolve to a real but wrong paper.** `ncbi.nlm.nih.gov/pubmed/20` became a
  genuine 1975 platelet-aggregation paper filed as a training citation. Scan for implausibly low
  PMIDs; `resolve_refs.py` now refuses anything below 1000.
- **Spoken years drift from published years** — usually epub-vs-print. Keep the creator's wording
  and put the real year in the link beside it.
- **Reference lists can be internally corrupt** — printed author and title not matching the paper
  the adjacent PubMed ID resolves to. Found across several Barbell Medicine articles.
- **Retractions arrive years later.** The Barbalho volume trials were load-bearing in three
  sources before anyone noticed. Run `check_retractions.py` on any new corpus.
- **Screening for mismatches is harder than it looks.** The first screen used a regex that choked
  on "et al." and silently covered 38 of 279 notes. The second flagged "Timestamps" while missing
  every genuine case. The third worked — vocabulary overlap between reference titles and note body
  — and validated itself by ranking both known-bad notes worst of 168. **Always sanity-check a
  screen against known positives before trusting it.**

### Source types, cheapest first

**Journal sources (PMC) are far cheaper and better than anything else.** One call returns full
text and a structured `<ref-list>` with each reference's own PMID and DOI — no caption fetch, no
extraction, no resolver step. The ISSN corpus yielded 5,192 references at 94% resolvable,
essentially free. Gotchas: ElementTree only supports `//` at the start of an XPath, so
`.//back//ack` silently matches nothing; older BMC-era XML concatenates reference fields without
separators, so build citations from `<element-citation>` sub-elements; and PubMed will not
phrase-match some organisation names, so query loosely and filter titles afterwards.

**Written articles are the next best thing, because of the inline `[n]` marker.** It sits on the
sentence, so a claim links to its paper exactly rather than by inference. Reach for a written
source before another YouTube channel.

**YouTube is the most expensive and least reliable.**
- Rate limiting is the main constraint. Fetch sequentially with a delay (1.5s fine, 6s when
  recovering). Parallel yt-dlp streams trip HTTP 429 immediately.
- The listing and download endpoints rate-limit separately: `--list-subs` can report English
  captions exist while the download 429s. Don't conclude "no captions" from a failed download.
- Recovery takes multiple passes with escalating backoff (1.5s → 6s → 20s → 60s). About 30
  transcripts that looked permanently lost came back this way.
- Expect the job to die partway; make it resumable and pipeline it — fetch in the background while
  agents write from whatever has landed.
- **Captions fail in three distinct ways:** no English track at all (unrecoverable);
  corrupt or auto-translated, which returns fluent-looking word salad an agent will happily
  hallucinate a note from; and **mangled researcher names**, which is the biggest accuracy risk.
  Real examples: "Bradshaw infilled" → Schoenfeld, "Boston" → Bhasin, "glass broke et al" →
  Glassbrook, "Judas et al" → Youdas, "javascitel" → Yavuz, "me Gian" → Wewege, "the ray of paper"
  → Rhea. **Take every name from the reference list, never from the audio.**

### Reading a consensus document critically

The ISSN pass turned up a pattern that generalises to any expert body: **the numbered position
statement is frequently firmer than the evidence review directly above it.** Several stands
describe a literature as "equivocal" or "largely null" and then assert a benefit in the headline.
When they disagree, trust the body.

So every ISSN note carries two mandatory sections — `Strength of the evidence` and
`Disclosures and funding`. That found real problems: a citation pointing to a paper on seasonal
reproduction in vertebrates, an unremoved peer-reviewer comment in a published table, a stand
citing a paper titled "does not alter…" as evidence that it does, and a disclosure statement
declaring no conflicts sitting directly above a conflict-of-interest section listing share
ownership in the product category.

**Self-citation is the bigger and less visible problem**, because it is not a declarable conflict.
Check whether a document's authors wrote the studies it rests on.

### Notes, not transcripts

Write summaries in your own words. Better for the reader, and it avoids reproducing the creator's
script wholesale. Video: 350–900 words, up to 2,500 for long interviews. Articles: scale to the
source, up to 2,800 for a 15,000-word piece. Long-form panels deserve a "where they disagreed"
section — in a panel the disagreement *is* the content.

### Windows/PowerShell gotchas

- Multi-line commit messages via here-strings word-split unpredictably. Build the message in a
  `$msg` variable with backtick-n newlines, or use `printf` from the Bash tool.
- Files written by PowerShell may carry a BOM that breaks Python string matching. Read with
  `utf-8-sig` everywhere.
- `Get-Content` displays UTF-8 as mojibake. The file is usually fine — verify with the Read tool
  before "fixing" anything.
- Set `sys.stdout.reconfigure(encoding='utf-8', errors='replace')` in any Python that prints note
  titles, or cp1252 will crash it.
- Foreground sleeps over ~5 min are blocked. Use `run_in_background`.
- **Don't read subagent output files** — they are full JSONL transcripts and will flood context.

---

## What is distinctive about each source

**Jeff Nippard** — the broadest, and the only one that groups its citations under the creator's own
topic headings, which is a far better claim-to-source map than anything inferable from a
transcript. 279 notes from 298 videos selected out of 486. Its known problems are listed at the
bottom of its own `SUMMARY.md` and are still unfixed.

**ISSN position stands** — formal consensus documents, and the corpus that proves journal sources
are worth reaching for first. Read them against themselves: the headline is often firmer than the
review above it.

**Menno Henselmans** — here *because* he disagrees. Caffeine cycling, protein in a deficit,
rest-interval floors, the effective-reps model, warm-ups, row selection. The notes mark each clash
rather than smoothing it. His characteristic failure is contrarianism as a stance — absolute claims
with no source.

**House of Hypertrophy** — the most densely cited channel, 1,557 citations across 169 videos, one
video citing 48 papers. Two things the notes handle explicitly: **26 videos have no retrievable
reference list at all**, including his longest and most confident work (the 73-study biceps guide,
the 63-study triceps guide, the 87-study mechanisms video that is the channel's intellectual
centre) — they cite on screen only. And the creator is **self-taught with no formal credentials**,
which he says himself; he is unusually careful in practice, and the notes say where that shows.
His `SUMMARY.md` records six positions he changed across years, which are features rather than
errors, but a reader hitting two notes out of order will see him arguing both sides.

**Barbell Medicine** — the only clinical source. The thing to know is that it is **two different
publications under one masthead**: the bylined clinician essays are the most careful evidence
appraisal in the library, while the unbylined "best X exercises" listicles are SEO content with
duplicated references and real errors. Checking the byline is the single most useful filter.
Across all 40 of its exercise articles, three claims are backed by measured growth.

---

## What Tim asked for, in his own framing

- Start from YouTube videos. He assumed I couldn't read them; I can, via captions.
- Cover a source **comprehensively**, not selectively. "I don't really care if you add 100 more
  videos to the file."
- **Objective/research content only.** Exercise rankings, technique, "science explained",
  myth-busts, interviews. Skip personal content — vlogs, travel, physique updates, competition
  prep, parodies, "I did this ___" challenges.
- Strip the filler. No intros, sponsor reads, program plugs, subscribe asks, teases.
- **Real citations matter.** "The actual research citings are genuinely important... when we state
  something, there's a link to the paper. If you aren't able to find the source, don't remove the
  information, just cite the parts that you can for now."
- One file per video or article, in a folder named for the source.
- Deploy as many sub-agents as possible to go faster.

## How Tim likes to work (from stored memory)

- **Commit and push finished work automatically.** Never ask first.
- **Talk plainly.** Short, direct replies. No decision codes, no long reports.
- **Don't ask what to do next.** Questions only about work already assigned; between jobs, report
  and stop.
- **Sub-agents are pre-authorised.** No need to ask permission per use.
- "Catch up with progress.md" means read-only — report and stop, don't start building.

He often runs **two sessions at once** — this research folder in one, the Fitness Tracker app in
the other. In the VSCode extension that is Command Palette → "Claude Code: Open in New Tab", or a
second VSCode window (`Ctrl+Shift+N`, and `"window.openFoldersInNewWindow": "on"` stops a new
folder replacing the current window). Note `Ctrl+Shift+Esc`, which the docs give as the new-tab
shortcut, is Task Manager on Windows and never reaches VSCode. This is why the git staging rule at
the top matters.

---

## If you add another source

1. **Measure, don't assume.** The probe that selected the current five checked catalogue size,
   median length, caption availability and reference links in a sample, with Nippard as a control
   (6/6, mean 14 links, which proved the detector worked).
2. **A description scan under-counts.** Three strong sources keep their grouped reference lists
   somewhere else entirely — House of Hypertrophy on per-video pages on his own site, Barbell
   Medicine in per-episode Google Docs, Andy Galpin in a "Scientific Articles" block on
   performpodcast.com. **Check the creator's website before rejecting them.**
3. **Check the licence, and respect robots.txt.** Some excellent sources are off-limits and you
   should not spend time on them: **Stronger By Science** forbids automated collection in its terms
   and blocks AI crawlers by name; **MASS** is subscriber-licensed; **Examine** is
   personal-use-only; **Chris Beardsley** is paywalled. Read and link to these, do not ingest them.
   Renaissance Periodization grants an unnamed Creative Commons licence — permissive but ambiguous,
   worth confirming.
4. **Classify the catalogue by hand.** It is judgement work and a bad inclusion list wastes an
   enormous amount of downstream agent time. Barbell Medicine's 206 articles were really two
   corpora: 155 substantial pieces and 51 to exclude, 43 of which were one templated SEO cluster
   repeating the same sentences across dozens of pages.
5. Prefer scripted 8–26 minute videos, or written articles. Conversational podcasts at a
   50-minute-plus median cost several times as much per note for less extractable content.
6. Then run the pipeline above, and **add the new source to
   [WHAT-TO-BELIEVE.md](WHAT-TO-BELIEVE.md)** — a source that is not adjudicated against the
   others is a folder, not a library.

---

## Nippard videos with no usable captions (19)

Not fetch failures — YouTube has no English caption track, or the track is corrupt.

How To Recover From Any Injury · You Can't Fix Your Posture · My Unfiltered Opinion on Steroids ·
How To Prevent Muscle Loss When Dieting · Can You Build Muscle In a Calorie Deficit / Lose Fat In
a Surplus · How to Use Bench Press for Growth · What Does RPE 10 Really Look Like · The 5 Worst
Diet Mistakes · The Fastest Way To Blow Up Your Upper Chest · Do Squats And Deadlifts Really Build
Abs · THE NATTY CURSE · How To Get Under 8% Bodyfat Naturally · 3 Supplements You Aren't Taking ·
Is Viagra Better Than Steroids · The Science Behind Intuitive Eating · How To Set Your Diet Up
After A Training Break · Of Leptin and Refeeds · WHAT IS MASS? · Effective Reps

Injury recovery and posture were the two worth chasing elsewhere. Barbell Medicine now covers both.
