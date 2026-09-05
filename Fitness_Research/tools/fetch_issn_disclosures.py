"""Pull competing-interest and funding declarations for the ISSN documents.

Usage:  python tools/fetch_issn_disclosures.py <sourcedir>

These live in the article's <back> matter, not <body>, so the main full-text pull
misses them. For supplement position stands that omission matters: several of
these documents are written by people with declared commercial ties to the very
compounds they assess, and at least one carries a "no conflict of interest"
disclosure statement sitting directly above a conflict-of-interest section listing
share ownership in the product category. A note that leaves that out is worse than
one that includes it.

Writes one text file per PMID. Kept separate from the full-text pull so it can be
re-run without disturbing anything else.
"""
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
UA = {"User-Agent": "fitness-research-notes/1.0 (mailto:sharedhadfield@gmail.com)"}

INTERESTING = re.compile(
    r"competing|conflict|financial|funding|disclosure|sponsor|advisor|"
    r"consult|shareholder|patent|employe|grant", re.I)


def get(url, tries=5):
    delay = 1.0
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(
                    urllib.request.Request(url, headers=UA), timeout=90) as r:
                return r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503) or attempt == tries - 1:
                raise
            time.sleep(delay)
            delay *= 2.5
    raise RuntimeError("unreachable")


def text_of(el):
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def back_matter(xml):
    art = ET.fromstring(xml).find(".//article")
    if art is None:
        return []
    out = []
    back = art.find(".//back")
    if back is not None:
        for child in back:
            if child.tag == "ref-list":
                continue
            # Keep the sub-section title where there is one - "Competing
            # interests" vs "Acknowledgements" is exactly the distinction we care
            # about, and flattening the whole block loses it.
            title = child.findtext("title") or child.findtext("sec/title") or child.tag
            body = text_of(child)
            if body and len(body) > 20:
                out.append((title.strip(), body))
    fg = art.find(".//funding-group")
    if fg is not None and text_of(fg):
        out.append(("funding-group", text_of(fg)))
    return out


def main():
    src = Path(sys.argv[1])
    dest = src / "disclosures"
    dest.mkdir(parents=True, exist_ok=True)
    index = json.loads((src / "index.json").read_text("utf-8"))

    flagged = []
    for rec in index:
        pmid, pmc = rec["pmid"], rec.get("pmc")
        if not pmc:
            continue
        time.sleep(0.4)
        try:
            blocks = back_matter(get("%s/efetch.fcgi?db=pmc&id=%s&retmode=xml"
                                     % (EUTILS, pmc)))
        except Exception as e:                       # noqa: BLE001
            sys.stderr.write("  %s failed: %s\n" % (pmid, e))
            continue
        if not blocks:
            sys.stderr.write("  %s: no back matter\n" % pmid)
            continue
        lines = ["# %s" % rec["title"], "PMID %s" % pmid, ""]
        hit = False
        for title, body in blocks:
            lines += ["## %s" % title, body, ""]
            if INTERESTING.search(title) or INTERESTING.search(body[:400]):
                hit = True
        (dest / ("%s.txt" % pmid)).write_text("\n".join(lines), encoding="utf-8")
        if hit:
            flagged.append(pmid)
        sys.stderr.write("  %s  %d blocks%s\n"
                         % (pmid, len(blocks), "  <- declarations" if hit else ""))

    sys.stderr.write("\n%d files, %d carry competing-interest or funding text\n"
                     % (len(list(dest.glob("*.txt"))), len(flagged)))


main()
