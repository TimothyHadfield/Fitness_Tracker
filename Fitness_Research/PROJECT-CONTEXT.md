# Project context — read this first

A handoff note for a fresh chat. Explains what this folder is, what Tim asked for, where
things stand, and — most usefully — **how to do the same thing for another YouTuber
without repeating the mistakes I made.**

---

## What this is

`Fitness_Research/` is a knowledge library. The goal is to summarise and organise research
on weightlifting (and eventually other fitness topics) into files that are actually
readable and traceable back to real papers.

The first source is Jeff Nippard, chosen because he acts as a library himself — he
summarises the research well and, crucially, **lists his sources in his video
descriptions**. That last fact is the single most important thing in this whole project.

## What Tim asked for, in his own framing

- Start from YouTube videos. He assumed I couldn't read them; I can, via captions.
- Cover the channel **comprehensively**, not selectively. "I don't really care if you add
  100 more videos to the file."
- **Objective/research content only.** Exercise rankings, technique, "science explained",
  myth-busts, interviews. Skip personal content — vlogs, travel, physique updates,
  competition prep, parodies, "I did this ___" challenges.
- Strip the filler. No intros, sponsor reads, program plugs, subscribe asks, teases.
- **Real citations matter.** "The actual research citings are genuinely important... when
  we state something, there's a link to the paper. If you aren't able to find the source,
  don't remove the information, just cite the parts that you can for now."
- One file per video, in a folder named for the creator.
- Deploy as many sub-agents as possible to go faster.

## How Tim likes to work (from stored memory)

- **Commit and push finished work automatically.** Never ask first.
- **Talk plainly.** Short, direct replies. No decision codes, no long reports.
- **Don't ask what to do next.** Questions only about work already assigned; between jobs,
  report and stop.
- **Sub-agents are pre-authorised.** No need to ask permission per use.
- "Catch up with progress.md" means read-only — report and stop, don't start building.

---

## Where things stand

**Done:**
- 279 notes in `Jeff Nippard videos/`, covering 298 videos selected from the channel's 486
- 2,075 resolved reference citations; 726 inline citations linking specific claims to specific papers
- 647 PubMed IDs + 132 PMC/DOI records resolved to full citations with DOIs
- `RESEARCH-CITATIONS.md` — master bibliography
- Reference-mismatch audit complete (see "Bad data" below)
- **The summary layer.** `SUMMARY.md` is a ~5,000-word top-level synthesis you read end to
  end. Under it sit six domain summaries — `SUMMARY-programming.md`,
  `SUMMARY-exercise-selection.md`, `SUMMARY-technique.md`, `SUMMARY-nutrition.md`,
  `SUMMARY-supplements-and-physiology.md`, `SUMMARY-myths-and-evidence.md` — each
  synthesising every note in its domain, ~59,000 words in total. `README.md` is a rebuilt
  index of all 279 notes in six domains and 51 subsections. Every internal link is
  verified; the partition was checked programmatically so no note is missing or
  double-filed.

**Not done — the remaining work:**
- **Fix the problems the summary pass surfaced.** They're listed in the "Known problems in
  this library" section at the bottom of `SUMMARY.md`: a citation that doesn't support its
  claim (Farina 2010 in the cable kickback note), several misleading filenames, one study
  rendered with three different effect sizes across notes, and a set of caption-garbled
  researcher names still marked uncertain.
- 19 videos have no usable English captions and were never written. They're listed at the
  bottom of this file.

---

## The pipeline

Scripts are in `tools/`. They contain absolute paths from the original session — **fix the
paths before reuse.** Run order:

1. **`fetch_transcript.py <url> <outdir>`** — pulls captions via yt-dlp, strips the
   rolling-caption duplicates, writes markdown with title/channel/date/URL header and
   `[mm:ss]` markers every ~30s. This is the only script already generalised.
2. **`make_slugs.py`** — turns video titles into stable, deduplicated note filenames.
3. **`extract_refs.py`** — pulls the reference block out of each video description,
   preserving the creator's own topic headings. **This grouping is the highest-value
   artifact in the pipeline** — it is the creator's own claim-to-source mapping.
4. **`resolve_pmids.py`** — PubMed IDs → full citations via NCBI esummary.
5. **`resolve_pmc_and_doi.py`** — PMC IDs → PMID via NCBI ID converter; embedded DOIs →
   Crossref. Recovers references that are otherwise bare URLs.
6. **`build_references.py`** — writes a `## References` section into every note and
   rebuilds the master bibliography.
7. **`screen_reference_mismatch.py`** — flags notes whose reference titles don't match
   their own subject. Run this; it catches real errors.

Then two agent passes: one to write the notes from transcripts, one to add inline
citations and fix caption-garbled researcher names.

---

## Lessons — read this part

### YouTube rate limiting is the main constraint

- **Fetch sequentially with a delay** (1.5s is fine; 6s when recovering). Parallel yt-dlp
  streams trip HTTP 429 immediately.
- The **listing endpoint and the download endpoint rate-limit separately.** `--list-subs`
  can report English captions exist while the actual subtitle download 429s. Don't
  conclude "no captions" from a failed download.
- Recovery takes **multiple passes with escalating backoff** (1.5s → 6s → 20s → 60s).
  I recovered ~30 transcripts this way that first appeared permanently lost.
- Expect the fetch job to die partway. Make it resumable — skip files already on disk.
- **Pipeline it.** Don't wait for all transcripts before writing notes. Fetch sequentially
  in the background while agents write notes in parallel from whatever has landed. The
  fetch is the bottleneck; keep the agents saturated.

### Captions are unreliable in three distinct ways

1. **No English track at all** — genuinely unrecoverable. ~13 videos here.
2. **Corrupt/auto-translated** — returns fluent-looking word salad. One video returned
   what looked like machine-translated Korean fragments. **An agent will happily
   hallucinate a note from this**, so instruct agents explicitly to skip and report
   rather than invent.
3. **Mangled researcher names** — pervasive and the biggest accuracy risk. Real examples:
   "Bradshaw infilled" → Schoenfeld, "Boston" → Bhasin, "glass broke et al" → Glassbrook,
   "Judas et al" → Youdas, "javascitel" → Yavuz, "me Gian" → Wewege, "the ray of paper"
   → Rhea. **Tell agents to flag uncertain names, never guess.** Then fix them in the
   citation pass, where the creator's own reference list confirms the real paper.

### The video description is the gold mine

Nippard groups his citations under his own topic headings ("Rep Speed:", "Creatine and
Hair Loss:"). That grouping is a far better claim-to-source mapping than anything you can
infer from a transcript. Fetch descriptions with `yt-dlp --write-description`. Check
whether your target creator does this before committing to the approach — if they don't,
the citation half of this project isn't possible.

### Resolving citations

- **PubMed** — NCBI esummary, batches of 150, no API key needed at this volume.
- **PMC IDs** — NCBI ID converter → PMID → esummary.
- **DOIs** — Crossref. Free, no key. Include a mailto in the User-Agent.
- **ResearchGate returns 403 to everything.** Two workarounds that worked: many RG URLs
  carry the paper title in the slug (search PubMed by title, and *verify* the returned
  title matches — I required 0.80 similarity); for bare RG IDs, the **Wayback CDX index**
  has the slug. An agent with WebSearch resolved all 13 bare IDs this way.
- Some journals (LWW, most strength-and-conditioning titles) aren't indexed anywhere
  machine-readable. Accept the bare link.

### Bad data — check for it, it's there

- **The creator pastes the wrong reference list.** Three of 279 here: creatine papers on a
  muscle-imbalance video, sexual-health papers on a training-when-sick video, a malformed
  link on a progression video. Flag these in place rather than deleting — the reader needs
  to know the sources don't support the claims.
- **A malformed URL can resolve to a real but wrong paper.** His description contained
  `ncbi.nlm.nih.gov/pubmed/20`, and my resolver dutifully turned PubMed record 20 into a
  genuine 1975 platelet-aggregation paper filed as a training citation. **Scan for
  implausibly low PMIDs after resolving.** This was my error, not his.
- **Spoken years drift from published years** — a "2015 study" that's 2016, a "2007
  review" that's 2017. Usually epub-vs-print. Keep the creator's wording and put the real
  year in the link beside it, so both are visible.
- **Screening for mismatches is harder than it looks.** My first screen used a regex that
  choked on "et al." and silently covered only 38 of 279 notes. My second screened
  reference *headings* and flagged "Timestamps" while missing every genuine case. The
  third worked — vocabulary overlap between reference titles and note body — and validated
  itself by ranking both known-bad notes as the worst two of 168. **Always sanity-check a
  screen against known positives before trusting it.**

### Working with agents at this scale

- Batches of **5-6 notes per agent** worked well. ~10 agents concurrently.
- Give an explicit `transcript file -> output filename` mapping. Don't let agents choose
  filenames; you'll get collisions and inconsistency.
- The instruction that mattered most: **"under-linking is much better than a wrong
  attribution."** Agents genuinely honoured it and left claims unlinked rather than
  guessing between two plausible papers.
- Tell them to **skip a bad transcript and say so** rather than produce something.
- Agents catch real problems if you let them. Mine found the mismatched reference lists,
  spotted that the "Big Three Roundtable" is about three guest lifters rather than
  squat/bench/deadlift, and noticed that a Kamal Patel interview titled as a supplement
  discussion never actually gets to supplements.
- Long-form panels and interviews deserve a **"where they disagreed" section** and a
  bigger word budget. In a panel the disagreement *is* the content; flattening four
  experts into one consensus voice throws away the value.

### Notes, not transcripts

Write summaries in your own words, not lightly-edited transcripts. Better for the reader,
and it avoids reproducing the creator's script wholesale. Target 400-900 words; allow
1,800-2,500 for long interviews.

### Windows/PowerShell gotchas

- Multi-line commit messages via here-strings word-split unpredictably. Build the message
  in a `$msg` variable with backtick-n newlines instead.
- Files written by PowerShell may carry a BOM that breaks Python string matching. Read
  with `utf-8-sig`.
- `Get-Content` displays UTF-8 as mojibake. The file is usually fine — verify with the
  Read tool before "fixing" anything.
- Foreground sleeps over ~5 min are blocked. Use `run_in_background`.
- Don't read subagent output files; they're full JSONL transcripts and will flood context.

---

## Videos with no usable captions (19)

Not fetch failures — YouTube has no English caption track, or the track is corrupt.

How To Recover From Any Injury · You Can't Fix Your Posture · My Unfiltered Opinion on
Steroids · How To Prevent Muscle Loss When Dieting · Can You Build Muscle In a Calorie
Deficit / Lose Fat In a Surplus · How to Use Bench Press for Growth · What Does RPE 10
Really Look Like · The 5 Worst Diet Mistakes · The Fastest Way To Blow Up Your Upper Chest
· Do Squats And Deadlifts Really Build Abs · THE NATTY CURSE · How To Get Under 8% Bodyfat
Naturally · 3 Supplements You Aren't Taking · Is Viagra Better Than Steroids · The Science
Behind Intuitive Eating · How To Set Your Diet Up After A Training Break · Of Leptin and
Refeeds · WHAT IS MASS? · Effective Reps

Injury recovery and posture are the ones actually worth chasing elsewhere — prehab is the
thinnest area in the library.

---

## If you're starting another creator

1. `yt-dlp --flat-playlist --print "%(id)s\t%(duration)s\t%(title)s"` on their `/videos`
   page to get the catalogue.
2. **Check one description for a reference list before anything else.** If they don't cite
   sources, this becomes a much smaller project — notes only, no citation layer.
3. Classify the catalogue by hand. It's judgement work and worth doing carefully; a bad
   inclusion list wastes an enormous amount of downstream agent time.
4. Then run the pipeline above.

Put each creator in their own folder, mirroring `Jeff Nippard videos/`.
