"""Deduplicate every reference across the ISSN stands into one bibliography.

Usage:  python tools/build_issn_bibliography.py <sourcedir> <notesdir>

The 27 stands cite ~6,200 references between them and they overlap heavily - the
same protein and creatine trials turn up in stand after stand. Deduplicating by
PMID and DOI turns that into a single sports-nutrition bibliography, and records
which stands cite each paper, so a paper cited by five stands is visibly load
bearing rather than incidental.

Also writes assignments.tsv: the pmid -> filename mapping the note-writing agents
are given. Agents are never allowed to pick filenames; that way lies collisions.
"""
import json
import re
import sys
from pathlib import Path

# Slugs are set by hand. Several stands were revised, so the year has to stay in
# the filename or the 2007 and 2017 protein stands collide.
SLUGS = {
    "41701327": "dietary-antioxidants",
    "40059405": "weight-cutting-strategies",
    "39810703": "omega-3",
    "39699070": "hmb-2025",
    "38934469": "ketogenic-diets",
    "37800468": "essential-amino-acids",
    "37498180": "coffee",
    "37221858": "female-athlete",
    "36862943": "energy-drinks-2023",
    "35813846": "tactical-athlete",
    "34503527": "sodium-bicarbonate",
    "33388079": "caffeine-2021",
    "31864419": "probiotics",
    "31699159": "ultra-marathon",
    "30068354": "issn-review-update-2018",
    "28919842": "nutrient-timing-2017",
    "28642676": "protein-2017",
    "28630601": "diets-and-body-composition",
    "28615996": "creatine-2017",
    "26175657": "beta-alanine",
    "23374455": "hmb-2013",
    "23281794": "energy-drinks-2013",
    "21410984": "meal-frequency",
    "20205813": "caffeine-2010",
    "18834505": "nutrient-timing-2008",
    "17908291": "protein-2007",
    "17908288": "creatine-2007",
}

YEAR = re.compile(r"\b(19|20)\d\d\b")

LEAD_NUM = re.compile(r"^\s*\[?\d{1,4}\]?[.)]?\s*")
TRAIL_PMC = re.compile(r"\s*PMC\d+\s*$")


def clean(text, pmid, doi):
    """PMC flattens the citation number and the trailing IDs into the text.

    A reference arrives looking like
        [12]Kerksick CM, et al. ... doi: 10.1186/s12970-018-0242-y30068354 PMC6090881
    with the PMID glued to the end of the DOI. Strip all of it - the identifiers
    are carried separately and rendered as links.
    """
    t = LEAD_NUM.sub("", text)
    t = TRAIL_PMC.sub("", t)
    if pmid and t.endswith(pmid):
        t = t[:-len(pmid)]
    return t.strip().rstrip(".") + "."


def key_for(ref):
    if ref.get("pmid"):
        return "pmid:" + ref["pmid"]
    if ref.get("doi"):
        return "doi:" + ref["doi"].lower()
    # Fall back to a normalised title-ish string so unlinked references still
    # deduplicate against themselves rather than appearing once per stand.
    return "txt:" + re.sub(r"[^a-z0-9]+", "", ref["text"].lower())[:120]


def main():
    src = Path(sys.argv[1])
    notes = Path(sys.argv[2])
    notes.mkdir(parents=True, exist_ok=True)

    index = json.loads((src / "index.json").read_text("utf-8"))
    by_pmid = {r["pmid"]: r for r in index}

    refs = {}
    for pmid, rec in by_pmid.items():
        f = src / "fulltext" / ("%s.json" % pmid)
        if not f.exists():
            continue
        doc = json.loads(f.read_text("utf-8"))
        for r in doc.get("refs", []):
            k = key_for(r)
            e = refs.setdefault(k, {
                "text": clean(r["text"], r.get("pmid", ""), r.get("doi", "")),
                "pmid": r.get("pmid", ""), "doi": r.get("doi", ""),
                "cited_by": []})
            if SLUGS.get(pmid) not in e["cited_by"]:
                e["cited_by"].append(SLUGS.get(pmid, pmid))
            # Prefer whichever rendering carries an identifier.
            if not e["pmid"] and r.get("pmid"):
                e["pmid"] = r["pmid"]
            if not e["doi"] and r.get("doi"):
                e["doi"] = r["doi"]

    ordered = sorted(refs.values(),
                     key=lambda e: (-len(e["cited_by"]), e["text"][:60].lower()))

    out = ["# ISSN position stands - master bibliography", "",
           "Every reference cited across the %d ISSN documents in this folder, "
           "deduplicated by PubMed ID and DOI." % len(by_pmid), "",
           "**%d unique references** from %d total citations. Sorted by how many "
           "stands cite them - a paper cited by several stands is doing more work "
           "than one cited once." % (len(ordered),
                                     sum(len(e["cited_by"]) for e in ordered)), "",
           "---", ""]
    multi = [e for e in ordered if len(e["cited_by"]) > 1]
    out.append("## Cited by more than one stand (%d)" % len(multi))
    out.append("")
    for e in multi:
        link = ""
        if e["pmid"]:
            link = " [PMID %s](https://pubmed.ncbi.nlm.nih.gov/%s/)" % (e["pmid"], e["pmid"])
        elif e["doi"]:
            link = " [doi:%s](https://doi.org/%s)" % (e["doi"], e["doi"])
        out.append("- %s%s  \n  *cited by: %s*" % (e["text"], link, ", ".join(sorted(e["cited_by"]))))
    out += ["", "---", "", "## Cited by one stand (%d)" % (len(ordered) - len(multi)), ""]
    for e in ordered[len(multi):]:
        link = ""
        if e["pmid"]:
            link = " [PMID %s](https://pubmed.ncbi.nlm.nih.gov/%s/)" % (e["pmid"], e["pmid"])
        elif e["doi"]:
            link = " [doi:%s](https://doi.org/%s)" % (e["doi"], e["doi"])
        out.append("- %s%s *(%s)*" % (e["text"], link, e["cited_by"][0]))

    (notes / "RESEARCH-CITATIONS.md").write_text("\n".join(out) + "\n",
                                                 encoding="utf-8", newline="\n")

    rows = []
    for pmid, rec in sorted(by_pmid.items(), key=lambda kv: kv[1]["date"], reverse=True):
        slug = SLUGS.get(pmid)
        if not slug:
            sys.exit("no slug for PMID %s: %s" % (pmid, rec["title"]))
        rows.append("\t".join([pmid, slug + ".md", str(rec.get("n_refs", 0)),
                               str(rec.get("words", 0)), rec["date"], rec["title"]]))
    (src / "assignments.tsv").write_text("\n".join(rows) + "\n",
                                         encoding="utf-8", newline="\n")

    with_id = sum(1 for e in ordered if e["pmid"] or e["doi"])
    print("%d unique refs (%d resolvable by PMID/DOI, %.0f%%), %d cited by >1 stand"
          % (len(ordered), with_id, 100.0 * with_id / len(ordered), len(multi)))
    print("assignments.tsv: %d notes" % len(rows))


main()
