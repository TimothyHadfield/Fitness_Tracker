# Retraction audit

Every PubMed ID this library cites, checked against PubMed for retractions, expressions of
concern and errata.

**Why this exists.** The library's whole claim is that a statement can be followed back to a real
paper. That claim fails silently when a paper is withdrawn after a source built an argument on it,
and nothing in the pipeline would notice. The Barbalho volume trials were exactly that case: they
were retracted for implausible data years after Jeff Nippard's videos were made, and the notes
kept citing them as evidence.

**Rerun it with:**

```
python tools/check_retractions.py sources/audit/retractions.json \
  sources "Jeff Nippard videos" "ISSN position stands" \
  "Menno Henselmans videos" "House of Hypertrophy videos"
```

Worth doing whenever a source is added, and periodically regardless — retractions arrive years
after publication, so a clean result today is not permanent.

---

## Result

**6,139 unique PubMed IDs checked. All 6,139 returned a record, so coverage is complete** — there
are no unchecked citations hiding in the total.

| Finding | Count |
| --- | --- |
| Retracted | **3** |
| Expressions of concern | 0 |
| Errata / corrections | 2 |
| PMIDs with no PubMed record | 0 |

Three retracted papers in 6,139 is a good result, and the two that matter were already partly
known. The third was not.

---

## The retracted papers

### Barbalho et al. 2019 — "Evidence for an Upper Threshold for Resistance Training Volume in Trained Women"

[PMID 30779716](https://pubmed.ncbi.nlm.nih.gov/30779716/) · *Med Sci Sports Exerc*

Cited in [5 Training Mistakes](Jeff%20Nippard%20videos/5-training-mistakes-everyone-makes-when-they.md),
where it was the sole support for a per-session volume threshold, and in
[House of Hypertrophy's splits note](House%20of%20Hypertrophy%20videos/comparing-training-splits-muscle-growth-20-studies.md),
which already discussed the retraction correctly.

**Action taken:** the Nippard note now flags the retraction inline and says the threshold claim
has lost its main support.

### Barbalho et al. 2020 — "Evidence of a Ceiling Effect for Training Volume in Muscle Hypertrophy and Strength in Trained Men — Less is More?"

[PMID 31188644](https://pubmed.ncbi.nlm.nih.gov/31188644/) · *Int J Sports Physiol Perform*

The more serious case. Cited in
[High Frequency Full Body Training](Jeff%20Nippard%20videos/high-frequency-full-body-training.md)
and, critically, in
[Is Workout Volume Killing Your Gains?](Jeff%20Nippard%20videos/workout-volume-killing-gains.md)
— **a note whose entire subject is this study.** The video exists to explain a result that should
not be treated as a result.

**Action taken:** the volume note carries a full retraction notice at the top setting out what
survives and what does not; the per-session ceiling does not survive, and later meta-regression
points the other way. The frequency note flags it inline.

### Amini et al. 2018 — omega-3 supplementation and mental health parameters

[PMID 30230402](https://pubmed.ncbi.nlm.nih.gov/30230402/)

**This one was not previously known.** It appears only in the
[ISSN bibliography](ISSN%20position%20stands/RESEARCH-CITATIONS.md), as a reference inside an ISSN
position stand's own reference list — no note in this library makes a claim resting on it, so the
exposure is limited to the bibliography entry, which is now marked.

Worth recording anyway, because it makes a general point: **the consensus documents this library
treats as its most authoritative source are themselves built on primary literature that can be
withdrawn.** An ISSN stand's reference list is not self-cleaning.

---

## Errata

Two, both minor, both left in place with no change to any claim:

- [PMID 34583397](https://pubmed.ncbi.nlm.nih.gov/34583397/) — a correction to Wadhi et al. on
  loaded inter-set stretching, cited in
  [the 2022 research round-up](House%20of%20Hypertrophy%20videos/best-muscle-growth-strength-research-2022.md).
- [PMID 28766558](https://pubmed.ncbi.nlm.nih.gov/28766558/) — a correction to Pahlavani et al. on
  L-arginine, in the ISSN bibliography only.

---

## What this does and does not prove

It proves that no *PubMed-indexed* citation in this library is retracted apart from the three
above, and that they are now marked wherever they appear.

It does not cover:

- **Links that never resolved to a PMID.** Across the four sources several hundred references are
  bare links to congress abstracts, unindexed strength-and-conditioning journals and rehosted
  PDFs. Nothing checks those, and nothing can, cheaply.
- **Preprints.** SportRxiv and bioRxiv material is cited in several notes. Preprints are not
  retracted so much as silently superseded, and the library has at least one headline claim
  resting on an unreviewed n=14 preprint.
- **Papers that are wrong but not withdrawn**, which is the far larger category. The Barbalho
  trials were caught because someone checked the variance patterns; most bad papers are never
  caught at all.
