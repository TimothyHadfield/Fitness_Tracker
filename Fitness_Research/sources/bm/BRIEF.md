# Shared brief — writing Barbell Medicine article notes

You are writing structured notes for a research knowledge library. Each note summarises one
article from barbellmedicine.com.

Working directory (everything below is relative to it):
`c:/Users/timha/OneDrive/Desktop/my-website/Code Projects/Fitness_Tracker/Fitness_Research/`

## Where things are

- **Article:** `transcripts/barbellmedicine/<slug>.md` — header with title, author, date and URL,
  then the article body in markdown with its inline reference markers preserved.
- **Extracted references:** `sources/bm/refs.json`, keyed by slug. Read your article's entry
  **before** you start writing. The fields that matter:
  - `mapping` — each reference number to its reference, **with the sentence and section heading
    it was cited in**. This is the thing that makes this source special. Use it.
  - `verified` — whether the marker-to-reference mapping passed its offset check.
    **If this is false, do not use the numbered mapping at all** (see below).
  - `references` — the article's own numbered list.
- **Resolved citations:** `sources/bm/citations.json` — reference to full citation with authors,
  title, journal, year, PMID and DOI. Unresolved ones are under `"unresolved"`.
- **Write your note to:** `Barbell Medicine articles/<filename>` — filenames are given to you.
  Do not invent filenames. Do not write anywhere else.

Read **one** existing note first to calibrate voice — `House of Hypertrophy videos/best-rep-range-build-muscle.md`.
Only one. Do not edit anything outside your assigned files.

## What makes this source different, and why it is here

Three things, and they should change how you write.

**1. The citations are exact.** Every other source in this library gives you a reference list for
a whole video and leaves you to infer which paper supports which claim. This one puts a numbered
marker on the sentence. **That means you can and should link claims to specific papers far more
tightly than anywhere else in the library** — the inference step is gone. Take advantage of it.
The usual rule still applies at the margin: under-linking beats a wrong attribution.

**2. The authors are practising clinicians** — physicians and physiotherapists, several with
academic appointments. This is the only source in the library qualified to write about injury,
pain and rehabilitation, and that is the gap it exists to fill. Where an article is clinical, say
what the clinical reasoning is, not just the conclusion.

**3. They argue a position, and it is a contested one.** Barbell Medicine is broadly aligned with
modern pain science: pain is not a reliable readout of tissue damage, imaging findings are common
in people with no symptoms, "good form" is far less load-bearing than the industry claims, and
most injuries are managed by modifying load rather than resting. This is mainstream in
physiotherapy research and heterodox in the gym. **Present it as their position with its
evidence, not as settled fact** — and where they overstate it, say so. A claim that posture does
not matter at all is not the same claim as the evidence that posture predicts pain poorly.

## The mapping check — this matters

`refs.json` records whether each article's marker-to-reference mapping was verified. The ISSN pass
in this library found documents where the numbering drifted by up to three, so `[135]` was not
reference 135, and a note built on that would attach real claims to the wrong papers.

- **`verified: true`** — use the `mapping` field freely. This is the good case, and it covers
  most articles.
- **`verified: false`** — **do not use the numbered mapping.** Treat the reference list as a
  reading list for the article as a whole, exactly as you would for a YouTube source.

  **But check *why* it failed before you describe it, because there are two different cases and
  saying the wrong one is an error in the note.** Look at the `mapping` field:
  - `mapping: "numbered"` with `verified: false` — the article *does* use numbered markers and
    they do not line up with its list. Thirteen articles are in this state, mostly the "best X
    exercises" batch whose lists duplicate and skip entries. Say the numbering does not line up.
  - `mapping: "inline-links"` or `"lumped"`, with zero markers — the article never used numbered
    citations at all. **Do not say the numbering is broken; there is no numbering.** Say the
    article cites by inline link or by a bottom list, so claim-level attribution was not
    available.

  In both cases you may still name a paper where the article names it in the sentence itself.

Never repair a broken mapping by guessing.

## Note format

```
# <Readable title — plain English>

**Source:** Barbell Medicine, "<original article title>" ([read](<url>)) · <author> · <YYYY-MM-DD> · <N> words
**Topic:** <one of: Injury & rehabilitation · Pain science · Programming · Exercise selection & technique · Load & reps · Volume & recovery · Nutrition · Health & medicine · Evidence & method>

## Bottom line
- <3–6 bullets. The specific claims and what they change.>

## <2–6 topical sections>

## References
<The studies cited, from citations.json. Where the mapping is verified, group them by the claim
they support, using the article's own section headings from the `mapping` field — that is the
creator's own claim-to-source structure and it is the most valuable thing here.
- Author A, Author B, et al. Title. *Journal* Year;vol:pages. [PMID xxxxx](link) or [doi](link)
Unresolved references go in as the plain-text citation the article gave.>
```

## Rules that matter most

1. **Link claims to specific papers.** This source supports it better than any other here. Where
   `verified` is true, the mapping tells you exactly which paper sits under which sentence.
2. **Record the numbers**: sample size, population, duration, effect size, and for clinical
   material the study design — an RCT and a cross-sectional imaging study support very different
   claims, and this source mixes them freely.
3. **Distinguish "the evidence shows X" from "we recommend X".** These authors are clinicians
   giving advice, and their advice frequently outruns their evidence in the ordinary way clinical
   advice does — reasonably, but it is still a different kind of claim. Mark the difference.
4. **Flag overreach in one sentence** where a conclusion outruns the evidence, including where a
   pain-science claim is stated more absolutely than the cited work supports.
5. **These articles sell things.** Barbell Medicine runs templates, seminars and a supplement
   line. Where an article recommends a product or programme they sell, say so plainly and without
   insinuation — the reader can weigh it. Strip the marketing copy itself.
6. **Write in your own words.** Notes, not lightly-edited article text. Their terms permit
   summarising, not republishing.
7. **If an article is unusable** — a stub, a duplicate, marketing with no content — write no note
   and report it.

## Length

The articles are much longer than the video transcripts elsewhere in this library. Note targets:

- under 1,500 words → **350–600**
- 1,500–3,000 → **600–900**
- 3,000–5,000 → **900–1,400**
- 5,000–8,000 → **1,400–2,000**
- over 8,000 → **2,000–2,800**, organised by the decision a reader is making rather than by the
  article's running order

## Reporting back

Under 400 words:
1. One line per note: filename, word count, references linked, whether the mapping was verified.
2. Any article you skipped and why.
3. Anything notable — where they contradict material already in this library (especially the
   training-variable claims from the YouTube sources), where a claim outruns its evidence, where
   they are unusually rigorous, where a recommendation coincides with something they sell.
