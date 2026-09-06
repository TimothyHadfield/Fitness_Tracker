"""Resolve an article source's references, including the ones with no link.

Usage:  python tools/resolve_refs_article.py <refs.json> <citations.json> [--fresh]

resolve_refs.py handles a reference that arrives as a URL. An article source
hands you something else as well: a *typed citation* with no link at all -

    Alentorn-Geli E, Samuelsson K, Musahl V, et al. The Association of
    Recreational and Competitive Running With Hip and Knee Osteoarthritis: A
    Systematic Review and Meta-analysis. J Orthop Sports Phys Ther. 2017.

Twenty-one Barbell Medicine articles carry inline [n] markers and not one
resolvable URL, so a resolver that only follows links would throw away their
whole bibliography while reporting success. This one adds title resolution on
top of the URL path, and imports the rest from resolve_refs.py so the guard
rails stay in one place rather than being reimplemented slightly differently.

THE GUARD RAIL, RESTATED
------------------------
Matching a typed citation to a paper is a guess, and a wrong guess is worse than
no answer: it attaches a real paper to a claim it does not support, and it looks
exactly like a correct answer. So a candidate is accepted only when one of two
things is true:

  - the returned title is a >= TITLE_MATCH (0.80) match for the title we parsed
    out of the citation, or
  - the returned title, normalised, appears verbatim inside the citation text

The second test is the stronger of the two and does most of the work here: if
the article literally typed the paper's title, that is not a guess. Everything
that satisfies neither is left unresolved, and the citation text is kept so a
reader still sees what the article actually cited.
"""
import argparse
import concurrent.futures
import difflib
import importlib.util
import io
import json
import os
import re
import sys
import threading
import time
import urllib.parse
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "resolve_refs", str(Path(__file__).with_name("resolve_refs.py")))
RR = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(RR)

CROSSREF_Q = "https://api.crossref.org/works?"

# A serial pass over this corpus is ~1,700 lookups at a second or three each,
# which is hours. Two small pools instead: Crossref runs a polite pool for
# clients that identify themselves (resolve_refs.py's User-Agent carries a
# mailto), and NCBI tolerates about three requests a second unkeyed. Keep these
# conservative - a 429 storm costs more than it saves.
CROSSREF_WORKERS = 8
NCBI_WORKERS = 3
CHECKPOINT_EVERY = 150

# A returned title short enough that finding it inside a citation proves nothing
# ("Introduction", "Obesity"). Below this, fall back to the similarity test.
MIN_CONTAINMENT = 30

# resolve_refs.py's floor is 0.80, and for a ResearchGate slug - which IS the
# paper's title - that is right. A typed citation is a different problem: the
# candidate title has been parsed out of prose and may be truncated or carry the
# journal with it, and domain titles are formulaic enough that near-misses score
# high. Higher floor, and an author has to agree.
TITLE_MATCH_TYPED = 0.93

QUOTED = re.compile(r"[“\"‘]([^”\"’]{20,300})[”\"’]")
AFTER_YEAR = re.compile(r"\(\d{4}[a-z]?\)\.?\s*(.{20,300}?)\.\s")
# A period that ends a sentence rather than an initial: preceded by a lowercase
# letter, a digit, or a closing bracket, and followed by a capital.
SENT = re.compile(r"(?<=[a-z0-9\)\]\?])\.\s+(?=[A-Z“\"])")

JOURNALISH = re.compile(
    r"(?i)^(j |journal|int j|am j|br j|eur j|scand|med sci|sports med|"
    r"nutrients|plos|front|cells|age |bmj|jama|lancet|nejm|physiol|"
    r"clin |appl |acta |arch |ann )")


def norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def candidate_titles(text):
    """Plausible titles inside a typed citation, best guess first."""
    out = []

    def add(t):
        t = re.sub(r"\s+", " ", (t or "")).strip(" .,;:")
        if len(t.split()) >= 4 and not JOURNALISH.match(t) and t not in out:
            out.append(t)

    m = QUOTED.search(text)
    if m:
        add(m.group(1))
    m = AFTER_YEAR.search(text)
    if m:
        add(m.group(1))
    # AMA style: "Author A, Author B, et al. Title of the paper. Journal. Year."
    # The author block ends at the first ". " even though it ends in an initial,
    # so split the head of the citation on plain periods and take what follows.
    parts = SENT.split(text)
    head = re.split(r"\.\s+", parts[0])
    for p in head[1:3]:
        add(p)
    # Anything after a sentence break that is not obviously a journal name.
    for p in parts[1:3]:
        add(p)
    if len(out) == 0:
        add(text)
    return out[:4]


def first_author(text):
    """The surname the citation opens with, which is nearly always the first
    author's. Used only to corroborate, never on its own."""
    m = re.match(r"[\s\[\]\d.]*([A-Z][A-Za-z'À-ſ-]{2,})", text)
    return m.group(1).lower() if m else ""


def accept(rec, cand, text):
    """Is this hit good enough to attach to the claim?

    The verbatim test is the one that matters: if the article typed the paper's
    title, the match is a fact rather than a guess.

    Similarity alone is NOT enough here, and that is a correction made after
    auditing the first pass. Sports-science titles are largely boilerplate -
    "Effects and dose-response relationships of X training on Y in youth: a
    systematic review and meta-analysis" - so at 0.80 a citation to a resistance
    training review matched a balance training review by the same authors, and a
    Cochrane Pilates review matched a different Pilates meta-analysis. Roughly a
    third of the similarity-only matches were wrong. So a similarity match now
    has to be near-exact AND be corroborated by the first author's surname
    appearing in the record. Everything else is left unresolved with its
    citation text intact, which is what the reader is better served by.
    """
    got = rec.get("title") or ""
    n_got = norm(got)
    if len(n_got) >= MIN_CONTAINMENT and n_got in norm(text):
        return True, "title appears verbatim in the citation"
    if cand:
        s = difflib.SequenceMatcher(None, cand.lower(), got.lower()).ratio()
        surname = first_author(text)
        corroborated = bool(surname) and any(
            surname in (a or "").lower() for a in rec.get("authors") or [])
        if s >= TITLE_MATCH_TYPED and corroborated:
            return True, "title match %.2f, first author corroborates" % s
    return False, ""


def pubmed_candidates(title):
    q = urllib.parse.urlencode({"db": "pubmed", "term": title[:300],
                                "retmax": "5", "retmode": "json"})
    raw = RR.get("%s/esearch.fcgi?%s" % (RR.EUTILS, q))
    time.sleep(0.4)
    if not raw:
        return {}
    try:
        ids = json.loads(raw)["esearchresult"]["idlist"]
    except (ValueError, KeyError):
        return {}
    return RR.esummary(ids) if ids else {}


def crossref_bibliographic(text):
    q = urllib.parse.urlencode({"query.bibliographic": text[:400], "rows": "5"})
    raw = RR.get(CROSSREF_Q + q)
    time.sleep(0.3)
    if not raw:
        return []
    try:
        items = json.loads(raw)["message"]["items"]
    except (ValueError, KeyError):
        return []
    out = []
    for m in items:
        names = []
        for au in m.get("author", [])[:8]:
            fam, giv = au.get("family", ""), au.get("given", "")
            if fam:
                names.append((fam + " " + giv[:1]).strip())
        date = (m.get("issued", {}).get("date-parts") or [[None]])[0]
        out.append({"authors": names,
                    "title": (m.get("title") or [""])[0].rstrip("."),
                    "journal": (m.get("container-title") or [""])[0],
                    "year": str(date[0]) if date and date[0] else "",
                    "volume": m.get("volume", ""), "pages": m.get("page", ""),
                    "pmid": "", "doi": m.get("DOI", "")})
    return out


def resolve_text(text):
    """A typed citation -> a real record, or None if we cannot prove the match."""
    cands = candidate_titles(text)
    for cand in cands:
        for rec in pubmed_candidates(cand).values():
            ok, _why = accept(rec, cand, text)
            if ok:
                return rec
    for rec in crossref_bibliographic(text):
        ok, _why = accept(rec, cands[0] if cands else "", text)
        if ok:
            return rec
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("refs")
    ap.add_argument("out")
    ap.add_argument("--fresh", action="store_true",
                    help="Re-resolve everything instead of reusing <out>.")
    ap.add_argument("--limit", type=int, default=0,
                    help="stop after this many typed-citation lookups")
    a = ap.parse_args()

    data = json.loads(io.open(a.refs, encoding="utf-8-sig").read())
    keys = []
    for v in data.values():
        for k in v["refs"]:
            if k not in keys:
                keys.append(k)
    sys.stderr.write("%d unique citation keys\n" % len(keys))

    cached = {}
    if not a.fresh and os.path.exists(a.out):
        try:
            prev = json.loads(io.open(a.out, encoding="utf-8-sig").read())
            cached = {k: r for k, r in prev.get("citations", {}).items()
                      if k in set(keys)}
        except (ValueError, KeyError):
            cached = {}
    todo = [k for k in keys if k not in cached]
    if cached:
        sys.stderr.write("  %d already resolved, %d to look up\n"
                         % (len(cached), len(todo)))

    urls = [k for k in todo if not k.startswith("text:")]
    texts = [k for k in todo if k.startswith("text:")]

    pmids, pmcs, dois, rgs, other, rejected = {}, {}, {}, {}, [], []
    for u in urls:
        m = RR.PMID_RE.search(u)
        if m:
            if int(m.group(1)) < RR.MIN_PMID:
                rejected.append((u, "PMID %s below plausibility floor" % m.group(1)))
            else:
                pmids[u] = m.group(1)
            continue
        m = RR.PMC_RE.search(u)
        if m:
            pmcs[u] = m.group(1)
            continue
        m = RR.RG_RE.search(u)
        if m:
            rgs[u] = RR.researchgate_title(m.group(2))
            continue
        m = RR.DOI_RE.search(urllib.parse.unquote(u))
        if m:
            dois[u] = m.group(1).rstrip(".").rstrip("/")
            continue
        other.append(u)

    sys.stderr.write("  urls: %d pubmed, %d pmc, %d doi, %d researchgate, "
                     "%d not resolvable by id, %d rejected\n"
                     % (len(pmids), len(pmcs), len(dois), len(rgs), len(other),
                        len(rejected)))
    sys.stderr.write("  typed citations with no link at all: %d\n" % len(texts))

    cites = dict(cached)

    got = RR.esummary(sorted(set(pmids.values())))
    for u, p in pmids.items():
        if p in got:
            cites[u] = got[p]

    conv = RR.pmc_to_pmid(sorted(set(pmcs.values())))
    extra = RR.esummary(sorted(set(conv.values())))
    for u, c in pmcs.items():
        p = conv.get(c)
        if p and p in extra:
            cites[u] = extra[p]

    lock = threading.RLock()

    def save():
        """Checkpoint. A long run that only writes at the end is a run that
        loses everything when the session is interrupted - the lesson this
        project has already learned twice with agents."""
        with lock:
            io.open(a.out, "w", encoding="utf-8", newline="\n").write(json.dumps(
                {"citations": cites,
                 "unresolved": [k for k in keys if k not in cites],
                 "rejected": rejected}, indent=1, ensure_ascii=False))

    def run_pool(items, fn, workers, label):
        done = [0]

        def work(item):
            try:
                rec = fn(item)
            except Exception:                          # noqa: BLE001
                rec = None
            with lock:
                if rec:
                    cites[item[0] if isinstance(item, tuple) else item] = rec
                done[0] += 1
                n = done[0]
            if n % CHECKPOINT_EVERY == 0:
                save()
                sys.stderr.write("    %s %d/%d\n" % (label, n, len(items)))
                sys.stderr.flush()

        if not items:
            return
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
            list(ex.map(work, items))
        save()
        sys.stderr.write("    %s %d/%d done\n" % (label, done[0], len(items)))

    run_pool(sorted(dois.items()), lambda it: RR.crossref(it[1]),
             CROSSREF_WORKERS, "crossref")
    run_pool(sorted(rgs.items()), lambda it: RR.pubmed_by_title(it[1]),
             NCBI_WORKERS, "researchgate")
    if a.limit:
        texts = texts[:a.limit]
    run_pool(texts, lambda k: resolve_text(k[5:]), NCBI_WORKERS,
             "typed citations")

    unresolved = [k for k in keys if k not in cites]
    save()

    n_txt_keys = sum(1 for k in keys if k.startswith("text:"))
    n_txt_ok = sum(1 for k in cites if k.startswith("text:"))
    sys.stderr.write("\nresolved %d/%d (%.0f%%)\n"
                     % (len(cites), len(keys), 100.0 * len(cites) / max(1, len(keys))))
    sys.stderr.write("  of those, typed citations matched by title: %d/%d (%.0f%%)\n"
                     % (n_txt_ok, n_txt_keys,
                        100.0 * n_txt_ok / max(1, n_txt_keys)))
    for u, why in rejected:
        sys.stderr.write("  rejected: %s (%s)\n" % (u, why))


if __name__ == "__main__":
    main()
