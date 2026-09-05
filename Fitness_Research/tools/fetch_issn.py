"""Pull the ISSN position stands from PubMed Central as full text plus references.

Usage:  python tools/fetch_issn.py <outdir>

Unlike the YouTube pipeline there is no caption step and no reference-extraction
step: PMC hands back the full article text AND a structured <ref-list> in the same
XML, so the references arrive already parsed with their own PMIDs and DOIs.

These are open access (CC BY 4.0, two of them CC BY-NC), which is why this source
is safe to build on. The licence of each is recorded in the header so a reader can
check rather than take our word for it.
"""
import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
UA = {"User-Agent": "fitness-research-notes/1.0 (mailto:sharedhadfield@gmail.com)"}

# PubMed does not index the society name as a searchable phrase - quoting it
# returns nothing at all. The bare terms do work, so filter the titles afterwards
# rather than trying to be clever in the query.
ALSO_KEEP = {"30068354"}   # ISSN exercise & sports nutrition review update

QUERIES = [
    "International Society of Sports Nutrition position stand",
    "Journal of the International Society of Sports Nutrition position statement",
    "ISSN exercise sports nutrition review update research recommendations",
]


def get(url, tries=5):
    """NCBI answers 429 readily at three requests a second. Back off and retry."""
    delay = 1.0
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503) or attempt == tries - 1:
                raise
            sys.stderr.write("  %d, backing off %.0fs\n" % (e.code, delay))
            time.sleep(delay)
            delay *= 2.5
    raise RuntimeError("unreachable")


def esearch():
    seen = []
    for term in QUERIES:
        q = urllib.parse.urlencode({"db": "pubmed", "term": term,
                                    "retmax": "200", "retmode": "json"})
        d = json.loads(get("%s/esearch.fcgi?%s" % (EUTILS, q)))
        for pmid in d.get("esearchresult", {}).get("idlist", []):
            if pmid not in seen:
                seen.append(pmid)
        time.sleep(0.5)
    return seen


def esummary(pmids):
    q = urllib.parse.urlencode({"db": "pubmed", "id": ",".join(pmids),
                                "retmode": "json"})
    return json.loads(get("%s/esummary.fcgi?%s" % (EUTILS, q)))["result"]


def pmcid_for(pmid, summary):
    for aid in summary.get("articleids", []):
        if aid.get("idtype") == "pmc":
            return aid["value"].replace("PMC", "")
    return None


def text_of(el):
    """Flatten an element to text, keeping nothing but the words."""
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def citation_text(ref):
    """Rebuild a readable citation from the XML.

    A <mixed-citation> already carries its own punctuation, so flattening it is
    right. An <element-citation> does not - its fields sit in separate tags, and
    flattening gives you "MetzlJDSmallELCreatine use among young athletesPediatrics2001".
    So assemble those field by field instead.
    """
    el = ref.find(".//element-citation")
    if el is None:
        el = ref.find(".//citation[@citation-type]")
    if el is None:
        return text_of(ref)

    names = []
    for nm in el.findall(".//name"):
        sur = nm.findtext("surname", "").strip()
        given = nm.findtext("given-names", "").strip()
        if sur:
            names.append((sur + " " + given).strip())
    if el.find(".//collab") is not None:
        names.append(text_of(el.find(".//collab")))

    authors = ", ".join(names[:6]) + (", et al" if len(names) > 6 else "")
    title = (el.findtext("article-title") or el.findtext("chapter-title") or "").strip()
    source = (el.findtext("source") or "").strip()
    year = (el.findtext("year") or "").strip()
    vol = (el.findtext("volume") or "").strip()
    fp = (el.findtext("fpage") or "").strip()
    lp = (el.findtext("lpage") or "").strip()

    bits = []
    if authors:
        bits.append(authors + ".")
    if title:
        bits.append(re.sub(r"\s+", " ", title).rstrip(".") + ".")
    tail = source
    if year:
        tail += " " + year if tail else year
    if vol:
        tail += ";" + vol
    if fp:
        tail += ":" + fp + ("-" + lp if lp else "")
    if tail.strip():
        bits.append(tail.strip() + ".")
    out = " ".join(bits).strip()
    return out if len(out) > 15 else text_of(ref)


def parse_pmc(xml):
    root = ET.fromstring(xml)
    art = root.find(".//article")
    if art is None:
        return None

    lic = ""
    lic_el = art.find(".//permissions/license")
    if lic_el is not None:
        lic = (lic_el.get("{http://www.w3.org/1999/xlink}href")
               or text_of(lic_el))[:200]

    # Body: keep section headings so the note-writer can see the structure.
    parts = []
    body = art.find(".//body")
    if body is not None:
        for sec in body.iter():
            if sec.tag == "title":
                t = text_of(sec)
                if t:
                    parts.append("\n## " + t + "\n")
            elif sec.tag == "p":
                t = text_of(sec)
                if t:
                    parts.append(t)
    if not parts:
        abst = art.find(".//abstract")
        if abst is not None:
            parts.append(text_of(abst))

    # Competing interests and funding live in <back>, not <body>. For supplement
    # position stands that is not a footnote - several of these are authored by
    # people with declared ties to the products they assess, and a note that omits
    # that is a worse note. Capture the back matter separately.
    # ElementTree only supports "//" at the start of a path, so walk the back
    # matter's children directly rather than trying to select them by XPath.
    disclosures = []
    back = art.find(".//back")
    if back is not None:
        for child in back:
            if child.tag == "ref-list":
                continue
            t = text_of(child)
            if t and len(t) > 20:
                disclosures.append(t)
    fg = art.find(".//funding-group")
    if fg is not None:
        t = text_of(fg)
        if t:
            disclosures.append(t)

    seen_d, uniq = set(), []
    for d in disclosures:
        if d[:120] not in seen_d:
            seen_d.add(d[:120])
            uniq.append(d)

    refs = []
    for ref in art.findall(".//ref-list/ref"):
        pmid = doi = ""
        for pid in ref.findall(".//pub-id"):
            if pid.get("pub-id-type") == "pmid":
                pmid = text_of(pid)
            elif pid.get("pub-id-type") == "doi":
                doi = text_of(pid)
        cite = citation_text(ref)
        if cite:
            refs.append({"text": cite, "pmid": pmid, "doi": doi})

    return {"license": lic, "body": "\n\n".join(parts),
            "disclosures": "\n\n".join(uniq), "refs": refs}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("outdir")
    a = ap.parse_args()
    out = Path(a.outdir)
    (out / "fulltext").mkdir(parents=True, exist_ok=True)

    pmids = esearch()
    sys.stderr.write("PubMed returned %d candidate position stands\n" % len(pmids))
    time.sleep(0.5)
    summ = esummary(pmids)

    index = []
    for pmid in pmids:
        s = summ.get(pmid)
        if not s or "error" in s:
            continue
        title = s.get("title", "").rstrip(".")
        # Filter out commentaries/replies that match the title search. PMID
        # 30068354 is the ISSN's comprehensive review update - not a position
        # stand, but the society's single most useful document, so keep it.
        low = title.lower()
        if ("position stand" not in low and "position statement" not in low
                and pmid not in ALSO_KEEP):
            sys.stderr.write("  skip (not a stand): %s\n" % title[:70])
            continue
        pmc = pmcid_for(pmid, s)
        rec = {"pmid": pmid, "pmc": pmc, "title": title,
               "journal": s.get("fulljournalname", ""),
               "date": s.get("pubdate", ""), "doi": "",
               "authors": [x["name"] for x in s.get("authors", [])][:12]}
        for aid in s.get("articleids", []):
            if aid.get("idtype") == "doi":
                rec["doi"] = aid["value"]

        if pmc:
            time.sleep(0.4)
            try:
                xml = get("%s/efetch.fcgi?db=pmc&id=%s&retmode=xml" % (EUTILS, pmc))
                parsed = parse_pmc(xml)
            except Exception as e:                   # noqa: BLE001
                parsed = None
                sys.stderr.write("  PMC fetch failed for %s: %s\n" % (pmid, e))
            if parsed and len(parsed["body"]) > 2000:
                rec["license"] = parsed["license"]
                rec["n_refs"] = len(parsed["refs"])
                rec["words"] = len(parsed["body"].split())
                (out / "fulltext" / ("%s.json" % pmid)).write_text(
                    json.dumps({**rec, **parsed}, indent=1), encoding="utf-8")
                rec["fulltext"] = True
            else:
                rec["fulltext"] = False
        else:
            rec["fulltext"] = False
        index.append(rec)
        sys.stderr.write("  %s  ft=%s refs=%s  %s\n"
                         % (pmid, rec.get("fulltext"), rec.get("n_refs", "-"),
                            title[:64]))

    index.sort(key=lambda r: r["date"], reverse=True)
    (out / "index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")
    ok = sum(1 for r in index if r.get("fulltext"))
    sys.stderr.write("\n%d stands, %d with full text, %d references total\n"
                     % (len(index), ok, sum(r.get("n_refs", 0) for r in index)))


if __name__ == "__main__":
    main()
