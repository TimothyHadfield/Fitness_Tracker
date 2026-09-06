#!/usr/bin/env python3
"""Gather figures from the open-access papers a source cites, and pair them to its notes.

    python tools/fetch_figures.py "Jeff Nippard videos" [--limit N] [--no-download]

Reads <source>/RESEARCH-CITATIONS.md, which groups every citation under the note that
cites it, and works forward:

    note -> PMID -> PMCID -> licence -> figure list -> image files

Only figures from articles carrying an explicit open licence (Creative Commons or a
public-domain dedication) are downloaded. Everything else is recorded with its caption
and a link to the figure on PMC, so the library knows the graph exists without
redistributing it. That is the same rule the project applies to Stronger By Science and
MASS: read and link, do not ingest.

Writes:
    <source>/figures/<PMCID>/<figure files>   the images
    <source>/figures/index.json               everything found, licensed or not

Resumable. Re-running skips any PMCID whose folder already holds its images, so an
interrupted run costs only what it had not yet fetched. Pass --fresh to redo the
metadata pass.

Rate limits: NCBI tolerates ~3 requests/second unauthenticated; Europe PMC is polite at
one call per article. Both are given a delay. If NCBI answers 429, back off and retry
rather than assuming the record is missing.
"""
import argparse
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

UA = {"User-Agent": "FitnessResearchLibrary/1.0 (mailto:sharedhadfield@gmail.com)"}
IDCONV = "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/"
EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest"

# Licences that permit redistribution with attribution. Anything not matching here is
# recorded but never downloaded. Both spellings matter: Europe PMC reports "cc by", while
# an article's own XML usually gives the licence as a creativecommons.org URL, and a
# pattern matching only the former silently drops the latter.
OPEN_LICENCE = re.compile(
    r"(cc[ -]by|cc0|public[ -]domain|creativecommons\.org/(?:licenses|publicdomain)/)", re.I
)

IMAGE_EXT = (".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff")


def get(url, timeout=60, tries=4):
    """Fetch a URL, backing off on 429 and 5xx rather than treating them as absent."""
    delay = 2
    for attempt in range(tries):
        try:
            return urllib.request.urlopen(
                urllib.request.Request(url, headers=UA), timeout=timeout
            ).read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in (429, 500, 502, 503, 504) and attempt < tries - 1:
                time.sleep(delay)
                delay *= 3
                continue
            return None
        except Exception:
            if attempt < tries - 1:
                time.sleep(delay)
                delay *= 3
                continue
            return None
    return None


def parse_citations(source_dir):
    """note filename -> sorted PMIDs, from the source's generated bibliography."""
    path = os.path.join(source_dir, "RESEARCH-CITATIONS.md")
    text = open(path, encoding="utf-8-sig").read()
    parts = re.split(r"^## \[([^\]]+)\]\(([^)]+)\)", text, flags=re.M)
    notes = {}
    for i in range(1, len(parts), 3):
        note_file, body = parts[i + 1], parts[i + 2]
        pmids = set(
            re.findall(
                r"(?:pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov/pubmed)/(\d+)", body
            )
        )
        if pmids:
            notes[note_file] = sorted(pmids)
    return notes


def to_pmcid(pmids):
    """PMID -> PMCID via the NCBI ID converter, 180 at a time."""
    out = {}
    for i in range(0, len(pmids), 180):
        batch = pmids[i : i + 180]
        url = IDCONV + "?" + urllib.parse.urlencode(
            {
                "tool": "fitnesslib",
                "email": "sharedhadfield@gmail.com",
                "format": "json",
                "ids": ",".join(batch),
            }
        )
        raw = get(url)
        if raw:
            for rec in json.loads(raw).get("records", []):
                if rec.get("pmcid"):
                    out[rec["pmid"]] = rec["pmcid"]
        print(f"  id conversion {min(i+180, len(pmids))}/{len(pmids)} -> {len(out)} in PMC", flush=True)
        time.sleep(0.5)
    return out


def article_meta(pmcids):
    """PMCID -> licence, open-access flag and citation metadata, 40 at a time."""
    meta = {}
    for i in range(0, len(pmcids), 40):
        batch = pmcids[i : i + 40]
        url = EPMC + "/search?" + urllib.parse.urlencode(
            {
                "query": " OR ".join("PMCID:" + p for p in batch),
                "resultType": "core",
                "format": "json",
                "pageSize": 100,
            }
        )
        raw = get(url)
        if raw:
            for r in json.loads(raw)["resultList"]["result"]:
                pmcid = r.get("pmcid")
                if not pmcid:
                    continue
                meta[pmcid] = {
                    "title": r.get("title", "").strip().rstrip("."),
                    "journal": (r.get("journalInfo") or {}).get("journal", {}).get("title", ""),
                    "year": (r.get("journalInfo") or {}).get("yearOfPublication"),
                    "authors": r.get("authorString", ""),
                    "doi": r.get("doi"),
                    "pmid": r.get("pmid"),
                    "licence": r.get("license"),
                    "open_access": r.get("isOpenAccess") == "Y",
                }
        print(f"  metadata {min(i+40, len(pmcids))}/{len(pmcids)}", flush=True)
        time.sleep(0.4)
    return meta


def _parse_article(raw):
    """Figures and licence out of a JATS article record."""
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return None, None
    figs = []
    for fig in root.findall(".//fig"):
        graphic = fig.find(".//graphic")
        href = None
        if graphic is not None:
            for k, v in graphic.attrib.items():
                if k.endswith("href"):
                    href = v
        label_el = fig.find("label")
        cap_el = fig.find("caption")
        figs.append(
            {
                "id": fig.get("id"),
                "label": " ".join("".join(label_el.itertext()).split()) if label_el is not None else None,
                "caption": " ".join("".join(cap_el.itertext()).split()) if cap_el is not None else "",
                "file": href,
            }
        )
    lic = None
    lic_el = root.find(".//permissions/license")
    if lic_el is not None:
        for k, v in lic_el.attrib.items():
            if k.endswith("href"):
                lic = v
        if not lic:
            lic = " ".join("".join(lic_el.itertext()).split())[:300]
    return figs, lic


def figures_for(pmcid):
    """Figure label, caption and image filename, plus the licence the article declares.

    NCBI's efetch carries full text for a wider set of PMC articles than Europe PMC's
    fullTextXML does — including some that are free-to-read but outside the OA subset —
    so it is tried first and Europe PMC is the fallback.
    """
    num = pmcid[3:] if pmcid.upper().startswith("PMC") else pmcid
    raw = get(
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
        f"?db=pmc&id={num}&retmode=xml"
    )
    if raw:
        figs, lic = _parse_article(raw)
        if figs is not None:
            return figs, lic
    raw = get(f"{EPMC}/{pmcid}/fullTextXML")
    if not raw:
        return None, None
    return _parse_article(raw)


def download_images(pmcid, wanted, dest):
    """Pull the article's image bundle and keep the files its figures point at.

    Europe PMC serves every image for an article in one zip, which is both faster and
    politer than fetching them one at a time. Thumbnails (.gif beside a .jpg of the same
    name) are dropped.
    """
    raw = get(f"{EPMC}/{pmcid}/supplementaryFiles", timeout=180)
    if not raw:
        return []
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        return []
    names = zf.namelist()
    stems = {os.path.splitext(w)[0].lower() for w in wanted if w}
    saved = []
    os.makedirs(dest, exist_ok=True)
    for name in names:
        base = os.path.basename(name)
        stem, ext = os.path.splitext(base)
        if ext.lower() not in IMAGE_EXT:
            continue
        if stems and stem.lower() not in stems:
            continue
        # prefer the raster original over its .gif thumbnail
        if ext.lower() == ".gif" and any(
            os.path.splitext(os.path.basename(n))[0].lower() == stem.lower()
            and os.path.splitext(n)[1].lower() in (".jpg", ".jpeg", ".png")
            for n in names
        ):
            continue
        data = zf.read(name)
        if len(data) < 3000:  # placeholder or spacer, not a real figure
            continue
        with open(os.path.join(dest, base), "wb") as fh:
            fh.write(data)
        saved.append({"file": base, "bytes": len(data)})
    return saved


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", help='e.g. "Jeff Nippard videos"')
    ap.add_argument("--limit", type=int, default=0, help="only process N articles (for probing)")
    ap.add_argument("--no-download", action="store_true", help="metadata only, fetch no images")
    ap.add_argument("--fresh", action="store_true", help="redo the metadata pass")
    args = ap.parse_args()

    src = args.source.rstrip("/\\")
    figdir = os.path.join(src, "figures")
    os.makedirs(figdir, exist_ok=True)
    index_path = os.path.join(figdir, "index.json")

    notes = parse_citations(src)
    pmids = sorted({p for v in notes.values() for p in v})
    print(f"{len(notes)} notes cite {len(pmids)} unique PubMed IDs")

    index = {}
    if os.path.exists(index_path) and not args.fresh:
        index = json.load(open(index_path, encoding="utf-8"))
        print(f"resuming from existing index ({len(index.get('articles', {}))} articles)")

    if not index.get("articles"):
        pmc = to_pmcid(pmids)
        print(f"{len(pmc)} of {len(pmids)} are in PubMed Central")
        meta = article_meta(sorted(set(pmc.values())))
        articles = {}
        for pmid, pmcid in pmc.items():
            m = meta.get(pmcid, {})
            m["pmid"] = pmid
            m["pmcid"] = pmcid
            lic = m.get("licence") or ""
            m["redistributable"] = bool(OPEN_LICENCE.search(lic))
            articles[pmcid] = m
        index = {"source": src, "notes": notes, "articles": articles}
        json.dump(index, open(index_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    articles = index["articles"]
    todo = [a for a in articles.values() if "figures" not in a]
    if args.limit:
        todo = todo[: args.limit]
    print(f"\nfetching figure lists for {len(todo)} articles")

    for n, art in enumerate(todo, 1):
        pmcid = art["pmcid"]
        figs, declared = figures_for(pmcid)
        art["figures"] = figs if figs is not None else []
        art["fulltext_available"] = figs is not None

        # Europe PMC leaves `license` empty for a good many articles that do declare one
        # in their own XML. Trust the article's own statement when the index has none.
        if declared:
            art["declared_licence"] = declared
            if not art.get("licence"):
                art["licence"] = declared
        art["redistributable"] = bool(
            OPEN_LICENCE.search(art.get("licence") or "")
            or OPEN_LICENCE.search(declared or "")
        )

        if figs and art["redistributable"] and not args.no_download:
            dest = os.path.join(figdir, pmcid)
            have = os.path.isdir(dest) and os.listdir(dest)
            if not have:
                saved = download_images(pmcid, [f["file"] for f in figs], dest)
                art["downloaded"] = saved
                time.sleep(0.6)
            else:
                art["downloaded"] = [
                    {"file": f, "bytes": os.path.getsize(os.path.join(dest, f))}
                    for f in sorted(os.listdir(dest))
                ]
        else:
            art.setdefault("downloaded", [])

        if n % 10 == 0 or n == len(todo):
            json.dump(index, open(index_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
            got = sum(len(a.get("downloaded", [])) for a in articles.values())
            print(f"  {n}/{len(todo)}  images saved so far: {got}", flush=True)
        time.sleep(0.4)

    json.dump(index, open(index_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    with_figs = [a for a in articles.values() if a.get("figures")]
    openish = [a for a in with_figs if a["redistributable"]]
    total_img = sum(len(a.get("downloaded", [])) for a in articles.values())
    total_mb = sum(
        f["bytes"] for a in articles.values() for f in a.get("downloaded", [])
    ) / 1e6
    print(
        f"\narticles in PMC          : {len(articles)}"
        f"\n  with a figure list     : {len(with_figs)}"
        f"\n  openly licensed        : {len(openish)}"
        f"\nfigures described        : {sum(len(a['figures']) for a in with_figs)}"
        f"\nimages downloaded        : {total_img} ({total_mb:.1f} MB)"
    )


if __name__ == "__main__":
    main()
