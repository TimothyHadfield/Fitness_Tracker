# Shared brief — writing House of Hypertrophy video notes

You are writing structured notes for a research knowledge library. Each note summarises one
video from the House of Hypertrophy YouTube channel.

Working directory (everything below is relative to it):
`c:/Users/timha/OneDrive/Desktop/my-website/Code Projects/Fitness_Tracker/Fitness_Research/`

## Where things are

- **Transcript:** `transcripts/hoh/<video-id>.md` — header with title, channel, publish date,
  length, URL, then caption text with `[mm:ss]` markers roughly every 30 seconds.
- **Description:** `transcripts/hoh/descriptions/<video-id>.txt` — timestamps, then usually a
  `References:` block. **Read this directly**; treat it as the authoritative reference list.
- **Resolved citations:** `sources/hoh/citations.json` — maps reference URLs to full citations
  (`authors`, `title`, `journal`, `year`, `pmid`, `doi`). Unresolved URLs are under
  `"unresolved"`.
- **Per-video extraction:** `sources/hoh/refs.json`, keyed by video id, with a `groups` field
  where he grouped references under his own sub-headings.
- **Write your note to:** `House of Hypertrophy videos/<filename>` — filenames are given to
  you. Do not invent filenames. Do not write anywhere else.

Read **one** existing note first to calibrate voice — `Jeff Nippard videos/junk-volume.md`.
Only one. Do not edit anything outside your assigned files.

## What makes this source different

This is the **most densely cited channel in the library** — 945 unique references across 169
videos, and single videos citing up to 48 papers. It is also the narrowest: almost every video
is about hypertrophy mechanisms, training variables, or a specific new study. There is no
nutrition-lifestyle content, no vlogs, no drama.

The creator (who goes by "Dhim") is **self-taught with no formal credentials** — he says so on
his own About page. Judge the arguments on the evidence he presents, and note where he leans on
mechanism over outcome data.

Three things to know about his style:

1. **He is unusually careful.** He routinely presents the study that contradicts his own
   conclusion, states sample sizes and training status, and distinguishes statistical
   significance from practical relevance. Where he does this, say so — it is a mark of quality
   and it is what makes this source trustworthy despite the missing credentials.
2. **He covers narrow questions in extreme depth.** A 20-minute video may be about one variable.
   Do not pad a narrow note into a broad one.
3. **His longest videos have no reference list at all.** The "ULTIMATE Guide" videos — the
   73-study biceps guide, the 63-study triceps guide, the 87-study mechanisms video — cite
   on-screen only, and their descriptions carry nothing. For those, write
   `## References` followed by a line saying the video cites its sources on screen only and no
   list is retrievable from the description, then list the studies named aloud **explicitly
   flagged as unverified**. Never invent a citation.

## Note format

```
# <Readable title — plain English, not the clickbait title>

**Source:** House of Hypertrophy, "<original video title>" ([watch](<url>)) · <YYYY-MM-DD> · <N> min
**Topic:** <one of: Mechanisms · Volume & frequency · Effort & failure · Load & reps · Range of motion & tempo · Exercise selection · Programming · Nutrition · Evidence & method>

## Bottom line
- <2–6 bullets. The specific findings and what they change.>

## <2–6 topical sections>

## References
<The studies this video cites, from citations.json:
- Author A, Author B, et al. Title. *Journal* Year;vol:pages. [PMID xxxxx](link) or [doi](link)
Where he grouped references under his own sub-headings (check the `groups` field in refs.json),
**keep that grouping** — it is his own claim-to-source mapping and it is the most valuable
structure available. Unresolved URLs go in as the bare link he gave.>
```

## Rules that matter most

1. **Link claims to specific studies wherever the mapping is clear** — and here it often is,
   because he discusses studies one at a time in sequence. This channel supports much tighter
   claim-to-source linking than most. But **under-linking is still better than a wrong
   attribution**.
2. **Auto-captions mangle researcher names.** Check the description's reference list before
   writing any name. If you cannot confirm it, describe the study without naming the author
   rather than guessing.
3. **If a transcript is unusable** — corrupt, machine-translated, or not about its title —
   write no note and report it. Never invent content from a bad transcript.
4. **Strip the filler.** No intros, no Alpha Progression app reads, no e-book plugs, no
   subscribe asks. The app segments are timestamped in the descriptions; skip those spans.
5. **Write in your own words.** Notes, not lightly-edited transcripts.
6. **Record the numbers that matter**: sample size, training status of subjects, duration, and
   effect size. He gives these, and they are what makes a finding usable.
7. **Flag overreach**, in one sentence, where a conclusion outruns the evidence — including
   where he over-relies on mechanism, EMG or acute measures rather than growth outcomes.

## Length

- 5–9 minute video → **350–600 words**
- 10–14 minute video → **600–900 words**
- 15–24 minute video → **900–1,400 words**
- 25 minute+ guides → **1,500–2,500 words**, organised by the decision a reader is making
  rather than by his running order

## Reporting back

Under 400 words:
1. One line per note: filename, word count, references linked.
2. Any transcript you skipped and why.
3. Anything notable — where he contradicts material already in this library, where a claim
   outruns its evidence, where he is unusually rigorous, or any error you spot.
