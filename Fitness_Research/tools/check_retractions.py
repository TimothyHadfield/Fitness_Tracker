"""Find retracted papers this library cites.

Usage:
    python tools/check_retractions.py <out.json> [paths...]

Harvests every PubMed ID it can find in the given files and directories - the
per-source citations.json stores, the RESEARCH-CITATIONS.md bibliographies, the
notes themselves - then asks PubMed what has happened to each one.

Why this exists. The Barbalho volume trials were retracted for implausible data
after several of this library's sources had already built arguments on them, and
nothing in the pipeline would have noticed. A library whose whole claim is that
you can follow a statement back to a real paper has to know when one of those
papers has been withdrawn. Everything else here is a summary; this is a check.

What it flags, in descending order of seriousness:

  RETRACTED   - PubMed marks the record "Retracted Publication". The paper is
                withdrawn. Any claim resting on it needs revisiting.
  CONCERN     - an expression of concern has been published. Not a retraction;
                the editors are signalling they are not sure.
  ERRATUM     - a correction exists. Usually minor, occasionally not.

A retraction notice is itself indexed in PubMed as a separate record, with the
publication type "Retraction of Publication". Those are not problems - if the
library cites one it is because a source was discussing the retraction - so they
are reported separately rather than flagged.

The check is deliberately conservative: it reports what PubMed says and does not
guess. A paper absent from PubMed is reported as unchecked, not as clean.
"""
import argparse
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
UA = {"User-Agent": "fitness-research-notes/1.0 (mailto:sharedhadfield@gmail.com)"}

# A PMID in a URL, or written out as "PMID 12345678".
PMID_IN_URL = re.compile(r"pubmed(?:\.ncbi\.nlm\.nih\.gov)?/(\d{4,8})\b", re.I)
PMID_WRITTEN = re.compile(r"\bPMID:?\s*(\d{4,8})\b", re.I)

# Below this, a "PMID" is almost certainly a truncated or malformed URL rather
# than a real record. The pipeline has been burned by this before: a description
# containing ".../pubmed/20" resolved to a genuine 1975 paper on platelet
# aggregation and filed it as a training citation.
MIN_PMID = 1000

RETRACTED = "Retracted Publication"
RETRACTION_NOTICE = "Retraction of Publication"
CONCERN = "Expression of Concern"
CONCERN_NOTICE = "Expression of Concern, Retracted"
ERRATUM = "Published Erratum"


def get(url, tries=5):
    """NCBI answers 429 readily. Back off rather than treating it as a miss."""
    for i in range(tries):
        try:
            with urllib.request.urlopen(
                    urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            if i == tries - 1:
                sys.stderr.write("  giving up on %s (%s)\n" % (url[:90], e))
                return None
            time.sleep(2 * (i + 1))
    return None


def harvest(paths):
    """Every PMID mentioned anywhere in the given files or directories."""
    found = {}
    files = []
    for p in paths:
        p = Path(p)
        if p.is_dir():
            files += [f for f in p.rglob("*")
                      if f.suffix.lower() in (".md", ".json", ".tsv")]
        elif p.exists():
            files.append(p)

    for f in files:
        try:
            text = io.open(f, encoding="utf-8-sig", errors="replace").read()
        except OSError:
            continue
        for rx in (PMID_IN_URL, PMID_WRITTEN):
            for m in rx.finditer(text):
                pmid = m.group(1).lstrip("0")
                if not pmid or int(pmid) < MIN_PMID:
                    continue
                found.setdefault(pmid, set()).add(str(f).replace("\\", "/"))
    return found, len(files)


def esummary(pmids, batch=180):
    """PubMed's summary record, which carries the publication-type list."""
    out = {}
    for i in range(0, len(pmids), batch):
        chunk = pmids[i:i + batch]
        url = "%s/esummary.fcgi?db=pubmed&retmode=json&id=%s" % (
            EUTILS, ",".join(chunk))
        raw = get(url)
        if raw:
            try:
                res = json.loads(raw).get("result", {})
            except ValueError:
                res = {}
            for pmid in chunk:
                rec = res.get(pmid)
                if isinstance(rec, dict) and "uid" in rec:
                    out[pmid] = rec
        sys.stderr.write("  esummary %d/%d\n" % (min(i + batch, len(pmids)),
                                                 len(pmids)))
        time.sleep(0.4)
    return out


def classify(rec):
    """What PubMed says has happened to this paper."""
    types = [t.strip() for t in (rec.get("pubtype") or [])]
    flags = []
    if RETRACTED in types:
        flags.append("RETRACTED")
    if CONCERN in types or CONCERN_NOTICE in types:
        flags.append("CONCERN")
    if ERRATUM in types:
        flags.append("ERRATUM")
    if RETRACTION_NOTICE in types and not flags:
        flags.append("IS_RETRACTION_NOTICE")
    return flags


def cite(rec):
    a = rec.get("authors") or []
    names = ", ".join(x.get("name", "") for x in a[:3])
    if len(a) > 3:
        names += ", et al"
    return "%s. %s %s %s" % (names, rec.get("title", "").rstrip("."),
                             rec.get("source", ""), rec.get("pubdate", ""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("paths", nargs="+")
    a = ap.parse_args()

    found, nfiles = harvest(a.paths)
    pmids = sorted(found, key=int)
    sys.stderr.write("%d files scanned, %d unique PMIDs\n" % (nfiles, len(pmids)))

    recs = esummary(pmids)
    sys.stderr.write("%d of %d PMIDs returned a record\n" % (len(recs), len(pmids)))

    report = {"retracted": [], "concern": [], "erratum": [],
              "retraction_notices": [], "not_in_pubmed": []}
    for pmid in pmids:
        rec = recs.get(pmid)
        if rec is None:
            report["not_in_pubmed"].append(
                {"pmid": pmid, "cited_in": sorted(found[pmid])})
            continue
        flags = classify(rec)
        if not flags:
            continue
        entry = {"pmid": pmid, "citation": cite(rec),
                 "pubtype": rec.get("pubtype"),
                 "cited_in": sorted(found[pmid])}
        if "RETRACTED" in flags:
            report["retracted"].append(entry)
        elif "CONCERN" in flags:
            report["concern"].append(entry)
        elif "IS_RETRACTION_NOTICE" in flags:
            report["retraction_notices"].append(entry)
        else:
            report["erratum"].append(entry)

    io.open(a.out, "w", encoding="utf-8", newline="\n").write(
        json.dumps(report, indent=1))

    print("\n%d retracted, %d expressions of concern, %d errata"
          % (len(report["retracted"]), len(report["concern"]),
             len(report["erratum"])))
    print("%d retraction notices cited (not a problem)"
          % len(report["retraction_notices"]))
    print("%d PMIDs returned no PubMed record - unchecked, not clean"
          % len(report["not_in_pubmed"]))
    for e in report["retracted"]:
        print("\nRETRACTED  PMID %s" % e["pmid"])
        print("  %s" % e["citation"][:150])
        for f in e["cited_in"][:12]:
            print("    %s" % f)
    for e in report["concern"]:
        print("\nCONCERN    PMID %s\n  %s" % (e["pmid"], e["citation"][:150]))


main()
