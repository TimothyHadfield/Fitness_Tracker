"""Resolve every PubMed link in the extracted reference blocks to a real citation.

NCBI's esummary API is public and needs no key at this volume. Anything that
isn't PubMed (ResearchGate, MASS, journal pages) is passed through untouched —
we record the link Nippard actually gave rather than guessing at a paper.
"""
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
REFS = HERE / "refs"
OUT = HERE / "citations.json"

PMID = re.compile(r"(?:pubmed\.ncbi\.nlm\.nih\.gov/|ncbi\.nlm\.nih\.gov/pubmed/)(\d+)")
ESUM = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"


def fetch(pmids):
    q = urllib.parse.urlencode(
        {"db": "pubmed", "id": ",".join(pmids), "retmode": "json"}
    )
    req = urllib.request.Request(
        f"{ESUM}?{q}", headers={"User-Agent": "fitness-research-notes/1.0"}
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def cite(rec):
    """PubMed record -> a readable citation string."""
    authors = [a["name"] for a in rec.get("authors", []) if a.get("authtype") == "Author"]
    if not authors:
        who = ""
    elif len(authors) == 1:
        who = authors[0]
    elif len(authors) == 2:
        who = f"{authors[0]} & {authors[1]}"
    else:
        who = f"{authors[0]} et al."
    year = (rec.get("pubdate") or "")[:4]
    title = (rec.get("title") or "").rstrip(".").replace("[", "").replace("]", "")
    journal = rec.get("source") or ""
    doi = ""
    for aid in rec.get("articleids", []):
        if aid.get("idtype") == "doi":
            doi = aid.get("value", "")
    return {
        "authors": who,
        "year": year,
        "title": title,
        "journal": journal,
        "doi": doi,
    }


# Collect every pmid across all videos.
pmids, per_video = set(), {}
for f in sorted(REFS.glob("*.md")):
    groups, header = [], None
    for line in f.read_text("utf-8").splitlines():
        if line.startswith("### "):
            header = line[4:].strip()
            groups.append({"topic": header, "links": []})
        elif line.startswith("- http") and groups:
            url = line[2:].strip()
            groups[-1]["links"].append(url)
            m = PMID.search(url)
            if m:
                pmids.add(m.group(1))
    per_video[f.stem] = groups

pmids = sorted(pmids)
print(f"unique pmids: {len(pmids)}")

resolved = {}
for i in range(0, len(pmids), 150):
    batch = pmids[i : i + 150]
    try:
        data = fetch(batch)
    except Exception as e:  # noqa: BLE001
        print(f"batch {i} failed: {e}")
        continue
    for pid, rec in data.get("result", {}).items():
        if pid == "uids" or not isinstance(rec, dict):
            continue
        if rec.get("error"):
            continue
        resolved[pid] = cite(rec)
    print(f"resolved {len(resolved)}/{len(pmids)}")
    time.sleep(0.5)

OUT.write_text(
    json.dumps({"per_video": per_video, "pmids": resolved}, indent=1), encoding="utf-8"
)
print(f"wrote {OUT}")
missing = [p for p in pmids if p not in resolved]
if missing:
    print(f"unresolved pmids ({len(missing)}): {', '.join(missing[:20])}")
