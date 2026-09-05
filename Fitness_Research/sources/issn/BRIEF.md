# Shared brief — writing ISSN position stand notes

You are writing structured notes for a research knowledge library. Each note summarises one
International Society of Sports Nutrition (ISSN) position stand.

## Where things are

- **Source data:** `sources/issn/fulltext/<PMID>.json`, relative to
  `c:/Users/timha/OneDrive/Desktop/my-website/Code Projects/Fitness_Tracker/Fitness_Research/`
  Each JSON has: `title`, `authors`, `journal`, `date`, `doi`, `pmid`, `license`,
  `body` (the full article text) and `refs` (the article's reference list, in order).
- **Write your notes to:** `ISSN position stands/<filename>` — filenames are given to you.
  Do not invent filenames and do not write anywhere else.
- An existing library of Jeff Nippard video notes sits in `Jeff Nippard videos/`. Read
  **one** of them first — `Jeff Nippard videos/creatine.md` — purely to calibrate house
  voice and note structure. Do not read more than one; do not edit anything there.

## The citation mechanism — this is the important part

The `body` text carries the article's own inline citation markers, like `[12]` or `[45-47]`.
Those numbers index into `refs`: marker `[12]` is `refs[11]` (they are 1-based, the array is
0-based). Every entry in `refs` has `text`, and usually `pmid` and `doi`.

**This means you can link a specific claim to a specific paper, exactly and verifiably.**
Do it throughout. That linkage is the single most valuable thing these notes carry.

Render an inline citation as a markdown link on the claim, e.g.

    loading at **0.3 g/kg/day for 5–7 days** saturates muscle stores
    ([Hultman 1996](https://pubmed.ncbi.nlm.nih.gov/8828669/))

Use the PubMed link when the ref has a `pmid`; otherwise `https://doi.org/<doi>`; if it has
neither, cite it by author and year in plain text with no link. **Never invent a PMID, a DOI
or an author name.** If a marker's number is out of range for `refs`, skip the link rather
than guessing — say the source is unclear.

## Note format

```
# <Readable title — plain English, not the journal title>

**Source:** ISSN position stand, *<journal>*, <date> · [PMID <pmid>](https://pubmed.ncbi.nlm.nih.gov/<pmid>/) · [doi](https://doi.org/<doi>)
**Authors:** <first 6, then "et al" if more>
**Licence:** <the licence URL from the JSON — say CC BY 4.0 / CC BY 2.0 / CC BY-NC 4.0 as appropriate>
**Topic:** <one of: Supplements · Protein & macronutrients · Nutrient timing · Body composition · Populations · Performance>

## The position, in one paragraph

<What this stand actually asserts, plainly.>

## Bottom line

- <6–12 bullets. The specific, actionable claims with their numbers, each linked to its paper.>

## <Then 4–8 topical sections of your choosing>

<Organised by the decision a reader is making, not by the article's own section order.
Numbers bolded. Every substantive claim linked to its source paper.>

## Strength of the evidence

<Honest appraisal. Which claims rest on large RCTs, which on mechanism or a single small
trial, and which are the authors' judgement. The stands vary a lot in this and it matters.>

## References

<Only the references you actually cited in this note, numbered as in the source article,
each with its PubMed or DOI link. Not the whole reference list — some of these articles
cite 500+ papers and the full list lives in RESEARCH-CITATIONS.md.>
```

## House style

- Plain, direct, unhyped prose. No "In conclusion", no filler, no marketing tone.
- Numbers up front and **bolded** — doses in both g/kg and g/lb where the source gives them.
- Tables where a table genuinely helps (dosing protocols, comparisons between subgroups).
- Target **900–1,600 words** per note, up to **2,200** for the longest stands.
- These are notes, not paraphrased abstracts. Write for someone deciding what to do.
- **Be honest about weakness.** A position stand is a consensus document with an interest in
  sounding confident; several of these make strong claims on thin evidence, and some are
  authored by people with industry ties the document itself discloses. Where the stand
  overreaches relative to the evidence it cites, say so plainly in "Strength of the evidence".
  Where it discloses conflicts of interest that bear on its conclusions, note that too.
- **Under-linking is much better than a wrong attribution.** If you are unsure which paper a
  claim rests on, leave it unlinked rather than guessing between two candidates.

## Reporting back

Keep your final message under 500 words:
1. One line per note: filename, word count, roughly how many inline citations you placed.
2. Anything genuinely notable — where a stand overreaches, where it contradicts another
   stand, where the evidence is thin, or where you spotted an error.
3. For revised pairs, a short account of what actually changed between editions.
