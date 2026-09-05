"""Build the master bibliography for a channel's notes.

Usage:
    python tools/build_channel_bibliography.py <sourcedir> <notesdir> <title>

Reads refs.json (what each video cited) and citations.json (what those URLs
resolve to) and writes RESEARCH-CITATIONS.md: every unique paper across the
channel, deduplicated, sorted so the papers several videos lean on come first.

Unresolved links are listed too, as the bare URL the creator gave. A reader is
better served by "here is the link he provided, we could not resolve it" than by
silence, and much better served than by a guess.
"""
import io
import json
import re
import sys
from pathlib import Path


def key_for(url, rec):
    if rec.get("pmid"):
        return "pmid:" + rec["pmid"]
    if rec.get("doi"):
        return "doi:" + rec["doi"].lower()
    return "url:" + url.lower()


def fmt(rec):
    a = rec.get("authors") or []
    if len(a) > 6:
        who = ", ".join(a[:6]) + ", et al"
    else:
        who = ", ".join(a)
    bits = []
    if who:
        bits.append(who + ".")
    if rec.get("title"):
        bits.append(rec["title"].rstrip(".") + ".")
    tail = rec.get("journal", "")
    if rec.get("year"):
        tail += " " + rec["year"] if tail else rec["year"]
    if rec.get("volume"):
        tail += ";" + rec["volume"]
    if rec.get("pages"):
        tail += ":" + rec["pages"]
    if tail.strip():
        bits.append(tail.strip() + ".")
    out = " ".join(bits)
    if rec.get("pmid"):
        out += " [PMID %s](https://pubmed.ncbi.nlm.nih.gov/%s/)" % (
            rec["pmid"], rec["pmid"])
    elif rec.get("doi"):
        out += " [doi:%s](https://doi.org/%s)" % (rec["doi"], rec["doi"])
    return out


def main():
    src, notes, title = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    refs = json.loads(io.open(src / "refs.json", encoding="utf-8").read())
    cit = json.loads(io.open(src / "citations.json", encoding="utf-8").read())
    cites = cit["citations"]

    slug_of = {}
    for line in io.open(src / "assignments.tsv", encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 2:
            slug_of[p[0]] = p[1]

    papers, unresolved = {}, {}
    for vid, v in refs.items():
        note = slug_of.get(vid)
        if not note:
            continue                      # excluded video
        for url in v["refs"]:
            rec = cites.get(url)
            if rec:
                k = key_for(url, rec)
                e = papers.setdefault(k, {"rec": rec, "notes": []})
                if note not in e["notes"]:
                    e["notes"].append(note)
            else:
                e = unresolved.setdefault(url, [])
                if note not in e:
                    e.append(note)

    ordered = sorted(papers.values(),
                     key=lambda e: (-len(e["notes"]), fmt(e["rec"])[:60].lower()))
    multi = [e for e in ordered if len(e["notes"]) > 1]

    out = ["# %s - master bibliography" % title, "",
           "Every source cited across the notes in this folder, deduplicated by "
           "PubMed ID and DOI.", "",
           "**%d resolved papers** and **%d links we could not resolve**, across "
           "%d videos that cite anything." % (
               len(ordered), len(unresolved),
               len({n for e in ordered for n in e["notes"]}
                   | {n for ns in unresolved.values() for n in ns})), "",
           "Sorted so that papers cited by several videos come first - those are "
           "the ones doing the most work.", "", "---", "",
           "## Cited by more than one video (%d)" % len(multi), ""]
    for e in multi:
        out.append("- %s  \n  *cited in: %s*"
                   % (fmt(e["rec"]),
                      ", ".join("[%s](%s)" % (n[:-3], n) for n in sorted(e["notes"]))))

    single = ordered[len(multi):]
    out += ["", "---", "", "## Cited by one video (%d)" % len(single), ""]
    for e in single:
        out.append("- %s *([%s](%s))*"
                   % (fmt(e["rec"]), e["notes"][0][:-3], e["notes"][0]))

    if unresolved:
        out += ["", "---", "",
                "## Links we could not resolve (%d)" % len(unresolved), "",
                "Mostly journals that are not indexed anywhere machine-readable - "
                "LWW and Elsevier resolver links especially. These are recorded as "
                "the creator gave them rather than guessed at.", ""]
        for url in sorted(unresolved):
            out.append("- <%s> *(%s)*"
                       % (url, ", ".join(n[:-3] for n in sorted(unresolved[url]))))

    io.open(notes / "RESEARCH-CITATIONS.md", "w", encoding="utf-8",
            newline="\n").write("\n".join(out) + "\n")
    print("%d resolved papers (%d cited more than once), %d unresolved links"
          % (len(ordered), len(multi), len(unresolved)))


main()
