# Shared brief — writing Menno Henselmans video notes

You are writing structured notes for a research knowledge library. Each note summarises one
video from Menno Henselmans's YouTube channel.

Working directory (everything below is relative to it):
`c:/Users/timha/OneDrive/Desktop/my-website/Code Projects/Fitness_Tracker/Fitness_Research/`

## Where things are

- **Transcript:** `transcripts/menno/<video-id>.md` — a header with title, channel, publish date,
  length and URL, then the caption text with `[mm:ss]` markers roughly every 30 seconds.
- **Description:** `transcripts/menno/descriptions/<video-id>.txt` — chapters, promo links, and
  usually a `Reference:` block of study URLs.
- **Resolved citations:** `sources/menno/citations.json` — maps each reference URL to a full
  citation (`authors`, `title`, `journal`, `year`, `pmid`, `doi`). Look your video's URLs up
  here. Some URLs are unresolved; those are listed under `"unresolved"`.
- **Your video's references:** `sources/menno/refs.json`, keyed by video id.
- **Write your note to:** `Menno Henselmans videos/<filename>` — filenames are given to you.
  Do not invent filenames. Do not write anywhere else.

Read **one** existing note first to calibrate voice — `Jeff Nippard videos/junk-volume.md`.
Only one. Do not edit anything in that folder.

## Who he is, and what makes this source different

Menno Henselmans is a former business analyst turned physique coach and researcher, publishing
on training and nutrition. Relative to the Jeff Nippard material already in this library:

- He is **more willing to contradict the evidence-based consensus**, and more combative about
  it. Where he takes a position against the mainstream, say so explicitly and give his
  reasoning — that disagreement is a large part of why this source is here.
- He covers **supplement-industry critique, behaviour and psychology, and study methodology**
  more than Nippard does.
- His videos are short and tightly scripted. Most run 5–15 minutes and make 2–5 substantive
  claims. **Do not pad.** A 6-minute video should produce a short note.

## Note format

```
# <Readable title — plain English, not the clickbait title>

**Source:** Menno Henselmans, "<original video title>" ([watch](<url>)) · <YYYY-MM-DD> · <N> min
**Topic:** <one of: Training · Nutrition · Supplements · Physiology · Evidence & methodology · Psychology & behaviour>

## Bottom line
- <2–6 bullets. The claims a reader would act on, with their numbers.>

## <2–5 topical sections>

## References
<Only the studies this video actually cites, from citations.json, formatted:
- Author A, Author B, et al. Title. *Journal* Year;vol:pages. [PMID xxxxx](link) or [doi](link)
If a URL is unresolved, record it as the bare link he gave — never guess at what it is.>
```

Where a video has no references at all, write `## References` followed by
`No sources given in the video description.` Do not silently omit the section.

## Rules that matter most

1. **Link claims to specific studies where the mapping is clear.** He usually gives a flat list
   rather than grouping references by claim, so the mapping is often ambiguous. **Under-linking
   is much better than a wrong attribution.** If you cannot tell which of five studies supports
   a claim, leave it unlinked.
2. **Auto-captions mangle researcher names.** Real examples from the last pass: "Bradshaw
   infilled" → Schoenfeld, "glass broke et al" → Glassbrook, "Judas et al" → Youdas. If the
   description's reference list confirms the real name, use it. **If you are not sure, write
   the name as uncertain or leave it out — never guess.**
3. **If a transcript is unusable** — corrupt, machine-translated word salad, or not actually
   about its title — **write no note and report it.** Do not invent content from a bad
   transcript.
4. **Strip the filler.** No intros, sponsor reads, app plugs, course plugs, subscribe asks,
   "before we get into it". None of that belongs in a note.
5. **Write in your own words.** These are notes, not lightly-edited transcripts.
6. **Flag overreach.** Where he states something more confidently than his cited evidence
   supports, or where a single small study is presented as settling a question, say so in one
   sentence. Do not editorialise beyond that.

## Length

- 5–8 minute video → **300–550 words**
- 9–15 minute video → **550–900 words**
- 15–30 minute video → **900–1,400 words**
- Long-form interviews (30 min+) → **1,500–2,500 words**, and include a
  `## Where they disagreed` section. In an interview the disagreement is the content;
  flattening two experts into one consensus voice throws away the value.

## Reporting back

Under 400 words:
1. One line per note: filename, word count, number of references linked.
2. Any transcript you skipped and why.
3. Anything notable — where he contradicts the evidence-based consensus, where he contradicts
   material already in this library, where a claim outruns its evidence, or any error you spot.
