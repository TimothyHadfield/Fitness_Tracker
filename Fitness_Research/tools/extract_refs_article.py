"""Pull the reference list and the inline [n] claim-to-source mapping out of articles.

Usage:  python tools/extract_refs_article.py <article-dir> <out.json>

This is the article-source cousin of extract_refs_desc.py, and it exists because
a written article gives something a video description never can. Barbell Medicine
writes numbered references at the bottom and drops [n] markers into the prose, so
the mapping from a specific claim to a specific paper is *stated*, not inferred.
That is the highest-value structure in this corpus and the whole point of the
script: for every marker we keep the number, the sentence it sits on, and the
section heading it sits under, so a note-writer can cite the paper that actually
supports the sentence rather than the paper that happens to be nearby.

Six marker dialects appear in this corpus and all six are handled. They were
found by looking, not by assuming: each of the last three was discovered only
after a document reported a mapping that made no sense.

    [12]            bare marker against a numbered list
    [12, 13]        composite; also [12,13], [1-4]
    ^12             superscript, surviving the HTML-to-markdown pass as a caret
    ¹²              superscript typed as Unicode, which the caret rule misses
                    entirely - 235 markers across the nine newest articles
    [^12](url)      the marker is itself the hyperlink, so there is no list
    [^Bermon 2018](url)
                    a named superscript link. 265 of these across six articles,
                    including the two longest in the corpus. There is no number
                    to drift, because the paper is named at the claim.

VERIFY, DO NOT TRUST
--------------------
The ISSN pass found marker/reference offset drift of up to three inside a single
document - [135] was not reference 135 - and a mapping that is quietly off by
three is worse than no mapping at all, because it reads as precise. So every
article is checked here and the result is recorded per article:

  - the highest marker number must not exceed the number of references parsed
  - markers that point past the end of the list are listed individually
  - references nobody cites are counted (high counts hint at a parse failure or
    at markers we failed to see, not necessarily at drift)

Anything that fails is marked verified=false with the reason, and downstream work
is expected to treat its numbers as unusable rather than merely suspect.

Articles with a reference list but no markers at all get the weaker treatment:
the list is kept, the mapping is recorded as "lumped", and no claim-level
attribution is offered. Saying so is the point - a note-writer must not be led to
believe a lumped list carries the same authority as a marked one.

OUTPUT SHAPE
------------
Per article slug:

  refs        flat list of citation keys, in reference order. A key is the URL
              where there is one and "text:<citation>" where the reference is
              plain text. This is the key build_channel_bibliography.py and
              citations.json both index on, so the shape matches every other
              source in the library.
  references  the numbered list itself: n, text, key, urls, doi, pmid, cited_at
  markers     every inline marker: numbers, kind, section heading, and the
              sentence it sits on
  verified    whether the numbering survived the checks, with the reasons
"""
import argparse
import io
import json
import re
from pathlib import Path

# ---------------------------------------------------------------------------
# reference-section detection
# ---------------------------------------------------------------------------

# The heading is written half a dozen ways across this corpus: a real heading, a
# bold line, with or without a colon, the colon inside or outside the asterisks.
# Kept generous; a missed heading turns a marked article into a lumped one, which
# throws away the mapping we came for.
HEADING = re.compile(
    r"(?im)^[#*_\s]*(references?|citations?|sources?|works cited|bibliography|"
    r"reference list|selected references)[\s*_:.\-]*$")

# A numbered reference entry at the start of a line: "12. Author A, ..." The
# markdown converter renders the site's <ol> this way, so the numbers are the
# site's own numbering rather than anything we assigned.
ENTRY = re.compile(r"(?m)^[ \t]*(\d{1,3})[.)][ \t]+(?=\S)")

URL = re.compile(r"https?://[^\s)>\]\"'*]+")
DOI_IN_TEXT = re.compile(r"\b(?:doi:\s*|https?://(?:dx\.)?doi\.org/)(10\.\d{4,9}/[^\s\"'<>)*\]]+)", re.I)
PMID_IN_TEXT = re.compile(r"pubmed\.ncbi\.nlm\.nih\.gov/(\d+)|ncbi\.nlm\.nih\.gov/pubmed/(\d+)")

MD_LINK = re.compile(r"\[([^\]]*)\]\((https?://[^)\s]+)\)")

SCIENTIFIC = re.compile(
    r"pubmed|ncbi\.nlm\.nih\.gov|doi\.org|/pmc/|pmc\.ncbi|researchgate|"
    r"sciencedirect|link\.springer|springer\.com|journals\.lww|lww\.com|"
    r"tandfonline|wiley|onlinelibrary|frontiersin|mdpi\.com|biomedcentral|"
    r"physiology\.org|sagepub|nature\.com|academic\.oup\.com|oup\.com|"
    r"sportrxiv|biorxiv|medrxiv|jamanetwork|nejm\.org|bmj\.com|jospt|"
    r"cambridge\.org|karger\.com|thieme|liebertpub|nih\.gov|cochrane|"
    r"linkinghub\.elsevier|elsevier\.com|humankinetics|jssm\.org|"
    r"iopscience|ahajournals|diabetesjournals|aspetjournals|apa\.org|psycnet|"
    r"scielo|hindawi|plos|peerj|f1000|nutrition\.org|ajcn|clinicalnutrition|"
    r"europepmc|semanticscholar|osf\.io|preprints\.org|cdnsciencepub|ovid\.com|"
    r"proquest|jstage\.jst\.go\.jp|jhk\.termedia\.pl|content\.iospress|"
    r"journals\.biologists|journal\.iusca\.org|jhse\.ua\.es|acsm\.org|"
    r"who\.int|cdc\.gov|fda\.gov|nice\.org\.uk|clinicaltrials\.gov|"
    r"annals\.org|acpjournals|thelancet|cell\.com|science\.org|pnas\.org|"
    # Guideline bodies, trial registries and clinical references. Physicians
    # cite these the way researchers cite journals, and dropping them loses the
    # evidence base of the medical articles specifically.
    r"health\.gov|dietaryguidelines\.gov|uspreventiveservicestaskforce|"
    r"wcrf\.org|anzctr\.org\.au|redalyc\.org|uptodate\.com|jacc\.org|"
    r"asnjournals|jamanetwork|degruyter|dovepress|jamda|arthritis|"
    r"weightology\.net|strongerbyscience\.com", re.I)

# The creator citing themselves. Real in the prose, but not a research citation.
SELF = re.compile(r"barbellmedicine\.com|youtube\.com|youtu\.be|instagram\.com|"
                  r"facebook\.com|twitter\.com|x\.com|podcasts\.apple\.com|"
                  r"open\.spotify|amazon\.|amzn\.to|linktr\.ee", re.I)

TRAILING = re.compile(r"[.,;:*]+$")


def clean_url(u):
    u = TRAILING.sub("", u.strip())
    while u and u[-1] in ")]}\u201d\u2019":
        u = u[:-1]
    return u


def sci_urls(text):
    out = []
    for u in URL.findall(text):
        u = clean_url(u)
        if SELF.search(u) or not SCIENTIFIC.search(u):
            continue
        if u not in out:
            out.append(u)
    return out


# ---------------------------------------------------------------------------
# markers
# ---------------------------------------------------------------------------

# [12] / [12,13] / [12, 13] / [1-4], not immediately followed by "(" (that is a
# markdown link, handled separately) and not preceded by "(" (that is a wrapped
# link target). The trailing (?!\d) matters: without it, "^ 2019" yields marker
# [201], which is how one article came to claim a 201st reference against a
# 97-entry list.
NUM = r"(?:\d{1,3})(?!\d)(?:\s*[,\u2013-]\s*\d{1,3}(?!\d))*"
BRACKET_MARKER = re.compile(r"(?<!\()\[(%s)\](?!\()" % NUM)

# ^12 / ^12,13 / ^12-14. The caret is what the site's <sup> becomes.
CARET_MARKER = re.compile(r"\^\s?(%s)" % NUM)

# The same marker typed as Unicode superscript characters rather than marked up
# as <sup>. Whole runs are one number; a comma separates two.
SUPDIGITS = "\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079"
SUP_MARKER = re.compile("([%s]+(?:\\s*[,\u00b7]\\s*[%s]+)*)" % (SUPDIGITS, SUPDIGITS))
SUP_TABLE = {ord(c): str(i) for i, c in enumerate(SUPDIGITS)}

# A superscript marker that is itself a hyperlink, in every arrangement of caret
# and brackets the corpus uses: [^12](url), ^[12](url), [^Bermon 2018](url),
# ^[Pielke 2016](url), and the same with the site's stray emphasis asterisks.
# The label may be a number (index into the list) or a name and year (which
# needs no list at all).
SUP_LINK = re.compile(
    r"(?:\^\s*\[\s*\*?\^?|\[\s*\*?\^)\s*([^\]\n]{1,80}?)\s*\*?\s*\]"
    r"\((https?://[^)\s]+)\)")

# [12](url) and [[12](url)] with no caret anywhere - a numbered marker that the
# site linked directly.
NUM_LINK = re.compile(r"\[\[?(\d{1,3}),?\]?\]?\((https?://[^)\s]+)\)")

LABEL_NUMS = re.compile(r"^[\s^*]*((?:\d{1,3})(?:\s*[,\u2013-]\s*\d{1,3})*)[\s.,;*]*$")

# "kg/m^2", "10^3" - exponents, not citations. Only 2 and 3 are ever ambiguous
# here; a superscript 21 after a word is always a reference.
EXPONENT = re.compile(r"(?i)(?:kg/m|/m|\bm|\bcm|\bmm|\bkm|\bin|\bft|\d|\be)$")

MD_HEADING = re.compile(r"(?m)^(#{1,6})\s*(.+?)\s*#*$")


def expand(numstr):
    """"1-4" -> [1,2,3,4];  "12, 13" -> [12,13]."""
    out = []
    for part in re.split(r"\s*,\s*", numstr.strip()):
        m = re.fullmatch(r"(\d{1,3})\s*[\u2013-]\s*(\d{1,3})", part)
        if m:
            lo, hi = int(m.group(1)), int(m.group(2))
            if lo <= hi and hi - lo < 60:
                out.extend(range(lo, hi + 1))
            continue
        if part.isdigit():
            out.append(int(part))
    return out


def strip_md(s):
    s = MD_LINK.sub(r"\1", s)
    s = re.sub(r"[*_#`]+", "", s)
    s = s.replace("\u00a0", " ")
    return re.sub(r"\s+", " ", s).strip()


def claim_before(body, pos, back=420):
    """The sentence the marker sits on.

    Markers land at the end of a sentence, so the useful context is what comes
    immediately before them. Walk back to a sentence boundary, and if none is
    close enough take a fixed window - a truncated sentence still tells a
    note-writer which claim this is.
    """
    start = max(0, pos - back)
    window = body[start:pos]
    # Cut at the last sentence end that is not an abbreviation or a marker.
    bounds = [m.end() for m in re.finditer(r"(?<![A-Z])[.!?]\s+(?=[A-Z\"'\u201c(])", window)]
    if bounds:
        window = window[bounds[-1]:]
    # Never cross a heading.
    hcut = None
    for m in MD_HEADING.finditer(window):
        hcut = m.end()
    if hcut is not None:
        window = window[hcut:]
    return strip_md(window)[-360:]


def section_of(body, pos):
    last = ""
    for m in MD_HEADING.finditer(body, 0, pos):
        last = strip_md(m.group(2))
    return last


def find_markers(body):
    """Every citation marker in the prose, with the claim it attaches to."""
    found = []          # (pos, kind, [numbers], url, label)
    consumed = []       # spans already claimed by an earlier, longer form

    def free(m):
        return not any(s <= m.start() < e for s, e in consumed)

    # Linked forms first: they contain the shapes the bare rules would match, so
    # matching them later would double-count and mislabel.
    for m in SUP_LINK.finditer(body):
        label, url = m.group(1), m.group(2)
        lm = LABEL_NUMS.match(label)
        if lm:
            found.append((m.start(), "linked-number", expand(lm.group(1)), url, ""))
        elif re.search(r"[A-Za-z]", label):
            found.append((m.start(), "linked-name", [], url, strip_md(label)))
        else:
            continue
        consumed.append((m.start(), m.end()))
    for m in NUM_LINK.finditer(body):
        if not free(m):
            continue
        found.append((m.start(), "linked-number", [int(m.group(1))], m.group(2), ""))
        consumed.append((m.start(), m.end()))

    for m in BRACKET_MARKER.finditer(body):
        if not free(m):
            continue
        ns = expand(m.group(1))
        if ns:
            found.append((m.start(), "bracket", ns, "", ""))
    for m in CARET_MARKER.finditer(body):
        if not free(m):
            continue
        ns = expand(m.group(1))
        if not ns:
            continue
        # Exponent guard: "kg/m^2" is not a citation.
        if len(ns) == 1 and ns[0] in (2, 3) and EXPONENT.search(body[:m.start()]):
            continue
        found.append((m.start(), "caret", ns, "", ""))
    for m in SUP_MARKER.finditer(body):
        if not free(m):
            continue
        ns = expand(m.group(1).translate(SUP_TABLE))
        if not ns:
            continue
        # "30 kg/m²" is a unit, not the second reference.
        if len(ns) == 1 and ns[0] in (2, 3) and EXPONENT.search(body[:m.start()]):
            continue
        found.append((m.start(), "superscript", ns, "", ""))

    found.sort()
    out = []
    for pos, kind, ns, url, label in found:
        rec = {"n": ns, "kind": kind, "pos": pos, "url": url,
               "section": section_of(body, pos),
               "claim": claim_before(body, pos)}
        if label:
            rec["label"] = label
        out.append(rec)
    return out


# ---------------------------------------------------------------------------
# reference list
# ---------------------------------------------------------------------------

def split_run_ons(refs):
    """Recover a reference the site glued onto the end of the previous one.

    Seen where an editor pasted two citations into one <li>: entry 8 ends
    "...NEJMoa2032183).9. Jastreboff AM, ...", and the ninth reference simply
    does not exist as far as the list is concerned - while the prose still cites
    [9]. Split only where the embedded number is exactly the next one expected,
    so an ordinary "2. " inside a citation cannot trigger it.
    """
    out = []
    for r in refs:
        text, n = r["raw"], r["n"]
        while True:
            m = re.search(r"(?<=[.)\]])\s*%d\.\s+(?=[A-Z])" % (n + 1), text)
            if not m:
                break
            head, text = text[:m.start()], text[m.end():]
            out.append({"n": n, "text": strip_md(head), "raw": head.strip(),
                        "repaired": True})
            n += 1
        out.append({"n": n, "text": strip_md(text), "raw": text.strip()})
    return out


def split_refs(section):
    """Numbered entries if the list is numbered, paragraphs if it is not."""
    hits = list(ENTRY.finditer(section))
    if len(hits) >= 2:
        refs = []
        for i, m in enumerate(hits):
            end = hits[i + 1].start() if i + 1 < len(hits) else len(section)
            text = section[m.end():end].strip()
            n = int(m.group(1))
            # Some entries carry the number twice - once from the <ol> and once
            # typed into the text by whoever pasted the list ("2 Boonyarom",
            # "3Jorgenson"). Drop the typed copy, but only when it agrees with
            # the list, so a reference that genuinely opens with a number keeps it.
            text = re.sub(r"^[\s*_]*%d[.)]?[\s*_]*(?=[A-Za-z“\"])" % n, "",
                          text.lstrip())
            refs.append({"n": n, "text": strip_md(text), "raw": text.strip()})
        return split_run_ons(refs), True
    # Unnumbered: blank-line separated entries, or one per line.
    chunks = [c.strip() for c in re.split(r"\n\s*\n", section) if c.strip()]
    if len(chunks) < 2:
        chunks = [c.strip() for c in section.splitlines() if c.strip()]
    refs = []
    for i, c in enumerate(chunks, 1):
        if len(c.split()) < 4:
            continue
        refs.append({"n": i, "text": strip_md(c), "raw": c})
    return refs, False


def find_ref_section(body):
    """The reference list, and the prose that precedes it.

    Take the LAST plausible heading rather than the first: "Further reading" and
    a mid-article "Sources" both appear, and picking the first would swallow half
    the article into the bibliography.
    """
    best = None
    for m in HEADING.finditer(body):
        tail = body[m.end():]
        refs, _ = split_refs(tail)
        if len(refs) >= 2:
            best = m
    if best is not None:
        return body[:best.start()], body[best.end():], True

    # No heading: a long run of numbered entries at the end is a reference list
    # even when nobody announced it. Require the run to reach the end of the
    # document and to start at 1, so a numbered how-to list mid-article does not
    # qualify.
    hits = list(ENTRY.finditer(body))
    if len(hits) >= 4 and int(hits[0].group(1)) == 1:
        tail_start = None
        for i, m in enumerate(hits):
            if int(m.group(1)) == 1 and i + 3 < len(hits):
                nums = [int(h.group(1)) for h in hits[i:]]
                if nums == list(range(1, len(nums) + 1)) and \
                        len(body) - hits[-1].end() < 4000:
                    tail_start = m.start()
                    break
        if tail_start is not None and tail_start > len(body) * 0.3:
            return body[:tail_start], body[tail_start:], False
    return body, "", False


def parse_header(text):
    meta = {}
    m = re.match(r"#\s*(.+)", text)
    if m:
        meta["title"] = m.group(1).strip()
    for key, field in (("Author", "author"), ("Published", "date"),
                       ("URL", "url"), ("Words", "words")):
        mm = re.search(r"(?m)^-\s*%s:\s*(.+)$" % key, text[:1200])
        if mm:
            meta[field] = mm.group(1).strip()
    if "words" in meta:
        try:
            meta["words"] = int(meta["words"])
        except ValueError:
            meta["words"] = 0
    return meta


def body_of(text):
    parts = text.split("\n---\n", 1)
    return parts[1] if len(parts) == 2 else text


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("adir")
    ap.add_argument("out")
    a = ap.parse_args()

    out = {}
    for f in sorted(Path(a.adir).glob("*.md")):
        text = io.open(f, encoding="utf-8").read()
        meta = parse_header(text)
        body_all = body_of(text)
        prose, refsec, had_heading = find_ref_section(body_all)
        refs, numbered = split_refs(refsec) if refsec.strip() else ([], False)
        markers = find_markers(prose)

        for r in refs:
            r["urls"] = sci_urls(r["raw"])
            d = DOI_IN_TEXT.search(r["raw"])
            r["doi"] = d.group(1).rstrip(".").rstrip("/") if d else ""
            p = PMID_IN_TEXT.search(r["raw"])
            r["pmid"] = (p.group(1) or p.group(2)) if p else ""
            r["cited_at"] = []
            # The citation key. A URL where the site gave one; a DOI promoted to
            # its resolver URL where it only typed "doi:..."; otherwise the
            # citation text itself, which the resolver has to match by title.
            if r["urls"]:
                r["key"] = r["urls"][0]
            elif r["doi"]:
                r["key"] = "https://doi.org/" + r["doi"]
            else:
                r["key"] = "text:" + r["text"]
            del r["raw"]

        by_n = {r["n"]: i for i, r in enumerate(refs)}
        for mi, mk in enumerate(markers):
            for n in mk["n"]:
                if n in by_n:
                    refs[by_n[n]]["cited_at"].append(mi)

        # ---- verification -------------------------------------------------
        # Only markers that index INTO the list can drift. A marker carrying its
        # own hyperlink names its paper at the claim, so there is nothing to
        # check and nothing that can silently go wrong.
        indexing = [mk for mk in markers if mk["n"] and not mk["url"]]
        selflinked = [mk for mk in markers if mk["url"]]
        named = [mk for mk in markers if mk["kind"] == "linked-name"]

        # An article whose citations are overwhelmingly self-linked is a
        # self-linked article, whatever stray numbers the markup leaves behind.
        # Two articles here carry 100+ named links and a bibliography at the
        # bottom; reading the two leftover digits as an index would report a
        # numbered mapping that does not exist.
        if len(indexing) < 3 and len(selflinked) >= 10:
            indexing = []

        marker_ns = sorted({n for mk in indexing for n in mk["n"]})
        max_marker = max(marker_ns) if marker_ns else 0
        dangling = [n for n in marker_ns if n not in by_n]
        uncited = [r["n"] for r in refs if not r["cited_at"]]

        prose_links = sci_urls(prose)

        if indexing and refs:
            mapping = "inline-numbered"
        elif selflinked:
            mapping = "inline-linked"
        elif indexing:
            mapping = "markers-without-list"
        elif refs:
            mapping = "lumped"
        elif prose_links:
            # Links sitting in the prose with no numbering and no list. Weaker
            # than a marker but still a claim-level attribution: the link is at
            # the sentence it supports.
            mapping = "inline-links"
        else:
            mapping = "none"

        problems = []
        if mapping == "inline-numbered":
            if max_marker > len(refs):
                problems.append(
                    "highest marker [%d] exceeds the %d references parsed"
                    % (max_marker, len(refs)))
            if dangling:
                problems.append("%d marker number(s) point past the list: %s"
                                % (len(dangling), dangling[:12]))
            if refs and len(uncited) > 0.6 * len(refs):
                problems.append(
                    "%d of %d references are never cited by a marker - the "
                    "mapping may be partial" % (len(uncited), len(refs)))
            nums = [r["n"] for r in refs]
            if nums != list(range(1, len(nums) + 1)):
                problems.append("reference numbering is not 1..N as parsed")
        if mapping == "markers-without-list":
            problems.append(
                "%d markers index a reference list that is not on the page"
                % len(indexing))
        verified = ((mapping == "inline-numbered" and not problems)
                    or mapping == "inline-linked")

        # Every citation key we can hand the resolver: the numbered list first,
        # then linked markers, then - only where there is no list at all - the
        # scientific links sitting in the prose.
        keys = []
        for r in refs:
            if r["key"] not in keys:
                keys.append(r["key"])
        for mk in markers:
            if mk["url"]:
                u = clean_url(mk["url"])
                if SCIENTIFIC.search(u) and not SELF.search(u) and u not in keys:
                    keys.append(u)
        # Prose links even where a list exists. Several medical articles carry
        # a short "References" list AND cite fourteen more papers inline; gating
        # this on "no list" threw those away and reported four citations for an
        # article with eighteen.
        for u in prose_links:
            if u not in keys:
                keys.append(u)

        # Plain-text citations - a reference with no link at all. These are the
        # ones the resolver has to find by title, and they are common enough
        # here that ignoring them would lose most of the bibliography.
        unlinked = [r["n"] for r in refs if not r["urls"] and not r["doi"]]

        out[f.stem] = {
            "title": meta.get("title", f.stem),
            "author": meta.get("author", ""),
            "date": meta.get("date", ""),
            "url": meta.get("url", ""),
            "words": meta.get("words", 0),
            "mapping": mapping,
            "numbered_list": numbered,
            "had_heading": had_heading,
            "n_refs": len(refs),
            "n_markers": len(markers),
            "n_indexing_markers": len(indexing),
            "n_selflinked_markers": len(selflinked),
            "n_named_markers": len(named),
            "max_marker": max_marker,
            "n_prose_links": len(prose_links),
            "n_unlinked_refs": len(unlinked),
            "n_uncited_refs": len(uncited),
            "verified": verified,
            "problems": problems,
            "refs": keys,
            "references": refs,
            "markers": markers,
        }

    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    io.open(a.out, "w", encoding="utf-8", newline="\n").write(
        json.dumps(out, indent=1, ensure_ascii=False))

    kinds = {}
    for v in out.values():
        kinds[v["mapping"]] = kinds.get(v["mapping"], 0) + 1
    marked = [v for v in out.values()
              if v["mapping"] in ("inline-numbered", "markers-without-list")]
    print("%d articles" % len(out))
    for k in sorted(kinds, key=lambda k: -kinds[k]):
        print("  %-22s %d" % (k, kinds[k]))
    print("%d references, %d unique citation keys, %d plain-text (unlinked) "
          "references"
          % (sum(v["n_refs"] for v in out.values()),
             len({u for v in out.values() for u in v["refs"]}),
             sum(v["n_unlinked_refs"] for v in out.values())))
    print("%d inline markers carrying a claim"
          % sum(v["n_markers"] for v in out.values()))
    print("%d inline-marked articles: %d verified, %d FAILED the check"
          % (len(marked), sum(1 for v in marked if v["verified"]),
             sum(1 for v in marked if not v["verified"])))
    print("%d articles carry a self-linked marker (%d of them named, which "
          "cannot drift)"
          % (sum(1 for v in out.values() if v["n_selflinked_markers"]),
             sum(1 for v in out.values() if v["n_named_markers"])))
    for slug, v in sorted(out.items()):
        if v["problems"]:
            print("  FAIL %-58s %s" % (slug, "; ".join(v["problems"])))


main()
