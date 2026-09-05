"""Resolve the reference links that aren't plain PubMed.

Two routes:
  PMC ids  -> NCBI ID converter -> PMID -> esummary
  embedded DOIs (springer, wiley, mdpi, frontiers, biomedcentral, sciencedirect,
                 doi.org) -> Crossref

Anything without a machine-resolvable identifier (LWW abstract pages, Examine,
MASS, ResearchGate) is left alone - we record the link he gave rather than guess.
"""
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
REFS = HERE / "refs"
OUT = HERE / "extra_citations.json"

PMC = re.compile(r"ncbi\.nlm\.nih\.gov/pmc/articles/(PMC\d+)", re.I)
DOI = re.compile(r"(10\.\d{4,9}/[^\s\"'<>&]+)")
IDCONV = "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/"
ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
CROSSREF = "https://api.crossref.org/works/"
UA = {"User-Agent": "fitness-notes/1.0 (mailto:sharedhadfield@gmail.com)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def fmt_authors(names):
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} & {names[1]}"
    return f"{names[0]} et al."


links = set()
for f in REFS.glob("*.md"):
    for line in f.read_text("utf-8").splitlines():
        if line.startswith("- http"):
            links.add(line[2:].strip())

pmc_map, doi_map = {}, {}
for url in links:
    if "pubmed.ncbi" in url or "/pubmed/" in url:
        continue
    m = PMC.search(url)
    if m:
        pmc_map.setdefault(m.group(1).upper(), []).append(url)
        continue
    d = DOI.search(urllib.parse.unquote(url))
    if d:
        doi = d.group(1).rstrip(".,;/")
        doi = re.sub(r"/(abstract|full|pdf)$", "", doi)
        doi_map.setdefault(doi, []).append(url)

print(f"pmc ids: {len(pmc_map)}   dois: {len(doi_map)}")

resolved = {}

# --- PMC -> PMID ---
pmcs = sorted(pmc_map)
pmid_for = {}
for i in range(0, len(pmcs), 100):
    batch = pmcs[i : i + 100]
    q = urllib.parse.urlencode({"ids": ",".join(batch), "format": "json"})
    try:
        data = get(f"{IDCONV}?{q}")
    except Exception as e:  # noqa: BLE001
        print(f"idconv failed: {e}")
        continue
    for rec in data.get("records", []):
        if rec.get("pmid"):
            pmid_for[rec.get("pmcid", "").upper()] = str(rec["pmid"])
    time.sleep(0.4)
print(f"pmc resolved to pmid: {len(pmid_for)}")

pmids = sorted(set(pmid_for.values()))
summaries = {}
for i in range(0, len(pmids), 150):
    q = urllib.parse.urlencode(
        {"db": "pubmed", "id": ",".join(pmids[i : i + 150]), "retmode": "json"}
    )
    try:
        recs = get(f"{ESUMMARY}?{q}").get("result", {})
    except Exception as e:  # noqa: BLE001
        print(f"esummary failed: {e}")
        continue
    for pid, rec in recs.items():
        if pid != "uids" and isinstance(rec, dict) and not rec.get("error"):
            summaries[pid] = rec
    time.sleep(0.4)

for pmcid, pmid in pmid_for.items():
    rec = summaries.get(pmid)
    if not rec:
        continue
    authors = [a["name"] for a in rec.get("authors", []) if a.get("authtype") == "Author"]
    doi = next((a["value"] for a in rec.get("articleids", []) if a.get("idtype") == "doi"), "")
    cite = {
        "authors": fmt_authors(authors),
        "year": (rec.get("pubdate") or "")[:4],
        "title": (rec.get("title") or "").rstrip("."),
        "journal": rec.get("source", ""),
        "doi": doi,
        "pmid": pmid,
    }
    for url in pmc_map[pmcid]:
        resolved[url] = cite

# --- DOI -> Crossref ---
done = 0
for doi, urls in doi_map.items():
    try:
        msg = get(CROSSREF + urllib.parse.quote(doi, safe="")).get("message", {})
    except Exception:  # noqa: BLE001
        continue
    authors = [
        a.get("family", "") for a in msg.get("author", []) if a.get("family")
    ]
    year = ""
    for key in ("published-print", "published-online", "created"):
        if msg.get(key, {}).get("date-parts"):
            year = str(msg[key]["date-parts"][0][0])
            break
    cite = {
        "authors": fmt_authors(authors),
        "year": year,
        "title": " ".join(msg.get("title") or []).rstrip("."),
        "journal": " ".join(msg.get("container-title") or []),
        "doi": msg.get("DOI", doi),
        "pmid": "",
    }
    if cite["title"]:
        for url in urls:
            resolved[url] = cite
        done += 1
    time.sleep(0.15)

print(f"crossref resolved: {done}")
OUT.write_text(json.dumps(resolved, indent=1), encoding="utf-8")
print(f"TOTAL newly resolved links: {len(resolved)}")
