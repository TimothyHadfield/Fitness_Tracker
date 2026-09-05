"""Resolve extracted reference URLs to real citations.

Usage:  python tools/resolve_refs.py <refs.json> <citations.json>

Handles, in order of reliability:
  - PubMed IDs            -> NCBI esummary
  - PMC IDs               -> NCBI ID converter -> esummary
  - DOIs (bare or in-URL) -> Crossref
  - everything else       -> kept as the bare link the creator actually gave

That last case matters. Several strength-and-conditioning journals are not indexed
anywhere machine-readable, and a bare link we can show the reader is worth more
than a guess. We never invent a citation for a link we cannot resolve.

Guard rails learned the hard way:

  - A malformed URL can resolve to a real but wrong paper. A description once
    contained ".../pubmed/20", and the resolver turned PubMed record 20 into a
    genuine 1975 platelet-aggregation paper filed as a training citation. Any PMID
    below MIN_PMID is refused.
  - ResearchGate answers 403 to everything, but its URLs carry the paper title in
    the slug. We search PubMed by that title and accept the hit only if the
    returned title is a close match, so a near-miss is left unresolved instead of
    being attached to the wrong paper.
"""
import argparse
import difflib
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
CONVERTER = "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/"
CROSSREF = "https://api.crossref.org/works/"
UA = {"User-Agent": "fitness-research-notes/1.0 (mailto:sharedhadfield@gmail.com)"}

# Real sports-science papers are seven or eight digits. Anything shorter is a
# truncated URL, not a citation.
MIN_PMID = 1000
TITLE_MATCH = 0.80

PMID_RE = re.compile(r"(?:pubmed\.ncbi\.nlm\.nih\.gov/|ncbi\.nlm\.nih\.gov/pubmed/)(\d+)")
PMC_RE = re.compile(r"(?:pmc\.ncbi\.nlm\.nih\.gov/articles/|/pmc/articles/)PMC(\d+)", re.I)
DOI_RE = re.compile(r"(10\.\d{4,9}/[^\s\"'<>&#?]+)")
RG_RE = re.compile(r"researchgate\.net/publication/(\d+)_([A-Za-z0-9_\-]+)")


def get(url, tries=4, timeout=60):
    delay = 1.0
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(
                    urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read().decode("utf-8", errors="replace")
        except Exception as e:                       # noqa: BLE001
            if attempt == tries - 1:
                return None
            time.sleep(delay)
            delay *= 2.5
    return None


def esummary(pmids):
    out = {}
    for i in range(0, len(pmids), 150):
        chunk = pmids[i:i + 150]
        q = urllib.parse.urlencode({"db": "pubmed", "id": ",".join(chunk),
                                    "retmode": "json"})
        raw = get("%s/esummary.fcgi?%s" % (EUTILS, q))
        time.sleep(0.4)
        if not raw:
            continue
        try:
            res = json.loads(raw).get("result", {})
        except ValueError:
            continue
        for pmid in chunk:
            s = res.get(pmid)
            if not s or "error" in s:
                continue
            authors = [a["name"] for a in s.get("authors", [])]
            doi = ""
            for aid in s.get("articleids", []):
                if aid.get("idtype") == "doi":
                    doi = aid["value"]
            out[pmid] = {
                "authors": authors, "title": s.get("title", "").rstrip("."),
                "journal": s.get("source", ""), "year": (s.get("pubdate") or "")[:4],
                "volume": s.get("volume", ""), "pages": s.get("pages", ""),
                "pmid": pmid, "doi": doi}
    return out


def crossref(doi):
    raw = get(CROSSREF + urllib.parse.quote(doi, safe=""))
    time.sleep(0.3)
    if not raw:
        return None
    try:
        m = json.loads(raw)["message"]
    except (ValueError, KeyError):
        return None
    names = []
    for a in m.get("author", [])[:8]:
        fam, giv = a.get("family", ""), a.get("given", "")
        if fam:
            names.append((fam + " " + giv[:1]).strip())
    date = (m.get("issued", {}).get("date-parts") or [[None]])[0]
    return {"authors": names,
            "title": (m.get("title") or [""])[0].rstrip("."),
            "journal": (m.get("container-title") or [""])[0],
            "year": str(date[0]) if date and date[0] else "",
            "volume": m.get("volume", ""), "pages": m.get("page", ""),
            "pmid": "", "doi": m.get("DOI", "")}


def pmc_to_pmid(pmcids):
    out = {}
    for i in range(0, len(pmcids), 100):
        chunk = pmcids[i:i + 100]
        ids = ",".join("PMC" + c for c in chunk)
        raw = get("%s?ids=%s&format=json" % (CONVERTER, ids))
        time.sleep(0.4)
        if not raw:
            continue
        try:
            recs = json.loads(raw).get("records", [])
        except ValueError:
            continue
        for r in recs:
            # The converter returns pmid as a number for some records and a
            # string for others; esummary only accepts strings.
            if r.get("pmid") and r.get("pmcid"):
                out[str(r["pmcid"]).replace("PMC", "")] = str(r["pmid"])
    return out


def researchgate_title(slug):
    return slug.replace("_", " ").strip()


def pubmed_by_title(title):
    q = urllib.parse.urlencode({"db": "pubmed", "term": title[:300],
                                "retmax": "3", "retmode": "json"})
    raw = get("%s/esearch.fcgi?%s" % (EUTILS, q))
    time.sleep(0.4)
    if not raw:
        return None
    try:
        ids = json.loads(raw)["esearchresult"]["idlist"]
    except (ValueError, KeyError):
        return None
    if not ids:
        return None
    cands = esummary(ids)
    best, score = None, 0.0
    for pmid, rec in cands.items():
        s = difflib.SequenceMatcher(
            None, title.lower(), rec["title"].lower()).ratio()
        if s > score:
            best, score = rec, s
    # Require a close title match. A near-miss here would attach a real paper to
    # the wrong claim, which is worse than leaving it unresolved.
    return best if best and score >= TITLE_MATCH else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("refs")
    ap.add_argument("out")
    a = ap.parse_args()

    data = json.loads(io.open(a.refs, encoding="utf-8").read())
    urls = []
    for v in data.values():
        for u in v["refs"]:
            if u not in urls:
                urls.append(u)
    sys.stderr.write("%d unique URLs\n" % len(urls))

    pmids, pmcs, dois, rgs, other = {}, {}, {}, {}, []
    rejected = []
    for u in urls:
        m = PMID_RE.search(u)
        if m:
            if int(m.group(1)) < MIN_PMID:
                rejected.append((u, "PMID %s below plausibility floor" % m.group(1)))
            else:
                pmids[u] = m.group(1)
            continue
        m = PMC_RE.search(u)
        if m:
            pmcs[u] = m.group(1)
            continue
        m = RG_RE.search(u)
        if m:
            rgs[u] = researchgate_title(m.group(2))
            continue
        m = DOI_RE.search(urllib.parse.unquote(u))
        if m:
            dois[u] = m.group(1).rstrip(".").rstrip("/")
            continue
        other.append(u)

    sys.stderr.write("  %d pubmed, %d pmc, %d doi, %d researchgate, %d unresolvable-by-id"
                     ", %d rejected\n"
                     % (len(pmids), len(pmcs), len(dois), len(rgs), len(other),
                        len(rejected)))

    cites = {}
    got = esummary(sorted(set(pmids.values())))
    for u, p in pmids.items():
        if p in got:
            cites[u] = got[p]

    conv = pmc_to_pmid(sorted(set(pmcs.values())))
    extra = esummary(sorted(set(conv.values())))
    for u, c in pmcs.items():
        p = conv.get(c)
        if p and p in extra:
            cites[u] = extra[p]

    for i, (u, d) in enumerate(sorted(dois.items())):
        rec = crossref(d)
        if rec:
            cites[u] = rec
        if (i + 1) % 40 == 0:
            sys.stderr.write("    crossref %d/%d\n" % (i + 1, len(dois)))

    for u, title in rgs.items():
        rec = pubmed_by_title(title)
        if rec:
            cites[u] = rec

    io.open(a.out, "w", encoding="utf-8").write(json.dumps(
        {"citations": cites, "unresolved": [u for u in urls if u not in cites],
         "rejected": rejected}, indent=1))
    sys.stderr.write("\nresolved %d/%d (%.0f%%)\n"
                     % (len(cites), len(urls), 100.0 * len(cites) / max(1, len(urls))))
    if rejected:
        sys.stderr.write("rejected as implausible:\n")
        for u, why in rejected:
            sys.stderr.write("  %s  (%s)\n" % (u, why))


main()
