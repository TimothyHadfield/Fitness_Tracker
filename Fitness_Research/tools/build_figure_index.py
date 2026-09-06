#!/usr/bin/env python3
"""Turn figures/index.json into FIGURES.md — the note-by-note figure index.

    python tools/build_figure_index.py "Jeff Nippard videos"

A figure belongs to a paper, and a paper is often cited by several notes, so the images
are stored once per paper under figures/<PMCID>/ and this index does the pairing. Every
note that cites a paper with figures gets a section listing them, with the caption, the
licence, and either a relative path to the stored image or a link to view it on PMC.

Figures whose licence does not permit redistribution are listed but not stored. That is
deliberate: knowing the graph exists, and what it shows, is most of the value, and the
link goes to the publisher's own copy.
"""
import argparse
import json
import os
import re
import sys
import urllib.parse

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# A caption that reads like a chart is worth surfacing first; these are the words that
# actually distinguish a plotted result from a photograph or a flow diagram.
CHARTY = re.compile(
    r"(\bforest plot|\bfunnel plot|\bdose[- ]response|\bregression|\bscatter|\bbox[- ]?plot|"
    r"\bbar (?:chart|graph)|\bgraph\b|\bplot(?:ted|s)?\b|\bmean\b|\bmedian\b|± ?se|± ?sd|"
    r"\bs\.?e\.?m\b|\berror bars?\b|\beffect size|\bconfidence interval|\bci\b|\bp *[<=>]|"
    r"\btime course|\bover time|\bpercent(?:age)? change|\bcorrelat|\bsignifican|"
    r"\bversus\b|\bvs\.?\b|\bcomparison|\bcurve|\btrend|\bdistribution|\bn *= *\d)",
    re.I,
)
DIAGRAMMY = re.compile(
    r"\b(flow ?chart|flow diagram|prisma|consort|schematic|study design|timeline|"
    r"protocol|apparatus|set-?up|photograph|photo of|anatomic|illustration|"
    r"starting .{0,20}position|ending .{0,20}position|electrode placement)\b",
    re.I,
)


def classify(caption):
    """chart / diagram / figure, from the caption alone.

    A diagram cue wins over a chart cue: a PRISMA flow diagram will happily say "n = 412"
    and a technique photo will mention a position, but neither is a plotted result. The
    point is only to float the graphs above the flowcharts, so a wrong call is cheap.
    """
    if DIAGRAMMY.search(caption or ""):
        return "diagram"
    if CHARTY.search(caption or ""):
        return "chart"
    return "figure"


def licence_label(article):
    """A short, honest name for the licence, instead of a paragraph of legal text."""
    raw = " ".join((article.get("licence") or article.get("declared_licence") or "").split())
    if not raw:
        return "no licence stated"
    low = raw.lower()
    if "publicdomain" in low or "cc0" in low or "public domain" in low:
        return "CC0 / public domain"
    m = re.search(r"creativecommons\.org/licenses/([a-z\-]+)/([0-9.]+)", low)
    if m:
        return f"CC {m.group(1).upper()} {m.group(2)}"
    m = re.match(r"cc[ -]([a-z\-]+)", low)
    if m:
        return f"CC {m.group(1).upper()}"
    if "text mining" in low:
        return "NIH manuscript — text mining/fair use only"
    if len(raw) > 70:
        return raw[:67].rstrip() + "…"
    return raw


def short(caption, limit=300):
    caption = " ".join((caption or "").split())
    if len(caption) <= limit:
        return caption
    cut = caption[:limit].rsplit(" ", 1)[0]
    return cut + "…"


def note_title(source_dir, note_file):
    path = os.path.join(source_dir, note_file)
    if not os.path.exists(path):
        return note_file
    for line in open(path, encoding="utf-8-sig"):
        if line.startswith("# "):
            return line[2:].strip()
    return note_file


FIG_LINE = re.compile(r"^\*\*Figures:\*\*.*$\n?", re.M)


def anchor_for(title):
    """The GitHub heading anchor for '## [title](note.md)'.

    The anchor comes from the rendered heading text, so the link target is stripped and
    only the visible title contributes.
    """
    s = title.lower()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    return re.sub(r"[-\s]+", "-", s).strip("-")


def annotate_notes(src, pairs):
    """Put a Figures line in each note that has figures, just under its Topic line.

    Idempotent: an existing Figures line is replaced, so re-running after a fetch updates
    the counts rather than stacking duplicates. Inserted *after* the Topic line because
    build_channel_readme.py reads that line to partition the index.
    """
    touched = 0
    for note_file, arts in pairs.items():
        path = os.path.join(src, note_file)
        if not os.path.exists(path):
            continue
        text = open(path, encoding="utf-8-sig").read()
        n_stored = sum(len(a.get("downloaded", [])) for a in arts)
        n_listed = sum(len(a["figures"]) for a in arts)
        title = note_title(src, note_file)
        anchor = anchor_for(title)
        if n_stored:
            body = (
                f"**Figures:** {n_stored} image{'s' if n_stored != 1 else ''} stored "
                f"from {sum(1 for a in arts if a.get('downloaded'))} of the papers below"
                + (f", {n_listed - n_stored} more listed" if n_listed > n_stored else "")
                + f" — [see FIGURES.md](FIGURES.md#{anchor})"
            )
        else:
            body = (
                f"**Figures:** {n_listed} in the papers below, none openly licensed "
                f"— [listed in FIGURES.md](FIGURES.md#{anchor})"
            )

        text = FIG_LINE.sub("", text)
        m = re.search(r"^\*\*Topic:\*\*.*$", text, re.M)
        if m:
            text = text[: m.end()] + "\n" + body + text[m.end():]
        else:
            m2 = re.search(r"^#\s+.+$", text, re.M)
            if not m2:
                continue
            text = text[: m2.end()] + "\n\n" + body + text[m2.end():]
        open(path, "w", encoding="utf-8", newline="\n").write(text)
        touched += 1
    return touched


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument(
        "--annotate-notes",
        action="store_true",
        help="add or refresh a **Figures:** line in every note that has figures",
    )
    args = ap.parse_args()
    src = args.source.rstrip("/\\")

    index = json.load(open(os.path.join(src, "figures", "index.json"), encoding="utf-8"))
    notes, articles = index["notes"], index["articles"]

    # PubMed IDs arrive as ints from one service and strings from another; normalise.
    by_pmid = {str(a["pmid"]): a for a in articles.values() if a.get("pmid")}

    # note -> the articles it cites that actually have figures
    pairs = {}
    for note_file, pmids in sorted(notes.items()):
        got = [
            by_pmid[str(p)]
            for p in pmids
            if str(p) in by_pmid and by_pmid[str(p)].get("figures")
        ]
        if got:
            pairs[note_file] = got

    n_img = sum(len(a.get("downloaded", [])) for a in articles.values())
    n_mb = sum(f["bytes"] for a in articles.values() for f in a.get("downloaded", [])) / 1e6
    n_stored_papers = sum(1 for a in articles.values() if a.get("downloaded"))
    n_fig = sum(len(a["figures"]) for a in articles.values() if a.get("figures"))
    n_charts = sum(
        1
        for a in articles.values()
        for f in a.get("figures", [])
        if classify(f.get("caption")) == "chart"
    )

    out = []
    w = out.append
    w("# Figures from the papers behind these notes\n")
    w(
        f"Every figure this source's cited papers publish, paired to the notes that cite them. "
        f"**{n_fig} figures across {sum(1 for a in articles.values() if a.get('figures'))} papers**, "
        f"of which **{n_charts} look like plotted results** rather than diagrams or photographs. "
        f"**{n_img} images ({n_mb:.0f} MB) from {n_stored_papers} openly licensed papers are stored "
        f"in [figures/](figures/)**; the rest are listed with a link to the publisher's copy.\n"
    )
    w(
        "**Before you reuse one, read [figures/README.md](figures/README.md).** Stored figures are "
        "Creative Commons and need attribution; the linked ones are not ours to redistribute.\n"
    )
    w(
        "Where a figure is stored, the path is relative to this file, so it renders inline in any "
        "markdown viewer and can be dropped straight into a page.\n"
    )
    w("---\n")

    w("## Notes with a stored figure\n")
    w("The ones you can actually display. Everything else is further down.\n")
    stored_notes = [
        (nf, arts) for nf, arts in pairs.items() if any(a.get("downloaded") for a in arts)
    ]
    for note_file, arts in stored_notes:
        n = sum(len(a.get("downloaded", [])) for a in arts)
        w(f"- [{note_title(src, note_file)}]({urllib.parse.quote(note_file)}) — {n} image{'s' if n != 1 else ''}")
    w("")
    w("---\n")

    for note_file, arts in pairs.items():
        w(f"## [{note_title(src, note_file)}]({urllib.parse.quote(note_file)})\n")
        for a in arts:
            pmcid = a["pmcid"]
            cite = f"{a.get('authors','')[:70]} {a.get('year') or ''}. *{a.get('title','')}*"
            cite = " ".join(cite.split())
            w(f"**{cite}**  ")
            lic = licence_label(a)
            state = "**stored**" if a.get("redistributable") else "link only"
            w(
                f"[{pmcid}](https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/)"
                f" · {lic} · {state}\n"
            )

            have = {f["file"] for f in a.get("downloaded", [])}
            for fig in a["figures"]:
                label = fig.get("label") or fig.get("id") or "Figure"
                kind = classify(fig.get("caption"))
                mark = {"chart": "📊", "diagram": "🗺", "figure": "🖼"}[kind]
                cap = short(fig.get("caption"))
                fname = fig.get("file") or ""
                match = next(
                    (h for h in have if os.path.splitext(h)[0].lower() == os.path.splitext(fname)[0].lower()),
                    None,
                )
                if match:
                    rel = f"figures/{pmcid}/{match}"
                    w(f"- {mark} **{label}** — {cap}")
                    w(f"  ![{label}]({urllib.parse.quote(rel)})")
                else:
                    url = f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/figure/{fig.get('id')}/"
                    w(f"- {mark} **{label}** — {cap} ([view]({url}))")
            w("")
        w("---\n")

    path = os.path.join(src, "FIGURES.md")
    open(path, "w", encoding="utf-8", newline="\n").write("\n".join(out))
    print(f"wrote {path}")

    # figures/README.md — the licence terms and the attribution line for every stored paper
    stored = sorted(
        (a for a in articles.values() if a.get("downloaded")),
        key=lambda a: (a.get("authors") or "").lower(),
    )
    r = []
    p = r.append
    p("# Stored figures — what they are and how to use them\n")
    p(
        f"{sum(len(a['downloaded']) for a in stored)} figure images from {len(stored)} papers, "
        f"one folder per paper, named by its PubMed Central ID. "
        f"[../FIGURES.md](../FIGURES.md) pairs them to the notes that cite them.\n"
    )
    p("## The rule this folder follows\n")
    p(
        "**Only figures under a Creative Commons or public-domain licence are stored here.** "
        "Every paper below states such a licence in its own metadata, which permits "
        "redistribution with attribution. Figures from papers that are free to read but not "
        "openly licensed — NIH author manuscripts, publisher-policy licences — are *not* in "
        "this folder. They are listed in `../FIGURES.md` with their captions and a link to the "
        "publisher's copy, which is the same read-and-link rule this project applies to "
        "Stronger By Science, MASS and Examine.\n"
    )
    p(
        "Every Creative Commons licence requires you to credit the authors and name the "
        "licence when you reuse a figure. The suffixes then add restrictions, and they matter:\n"
    )
    p("- **BY** — credit the authors. No other restriction.")
    p("- **NC** — non-commercial use only.")
    p(
        "- **ND** — no derivatives. Share the figure whole and unaltered; do not crop it, "
        "recolour it, restyle it or pull one panel out of a multi-panel figure."
    )
    p("- **SA** — share-alike: anything you build from it carries the same licence.\n")
    p(
        "**Check the licence in the list below before publishing any of these**, and keep the "
        "credit line with the image. Captioning a figure with its source is good practice "
        "regardless — it is the thing that makes the claim checkable.\n"
    )
    p("## Regenerating\n")
    p("```\npython tools/fetch_figures.py \"" + src + "\"\npython tools/build_figure_index.py \"" + src + "\"\n```\n")
    p(
        "Both are resumable and skip work already done. `fetch_figures.py` re-checks licences "
        "on every run, so a paper whose licence changes stops being downloaded.\n"
    )
    p("## Attribution\n")
    p("| Folder | Licence | Credit |")
    p("| --- | --- | --- |")
    for a in stored:
        cite = " ".join(
            f"{a.get('authors','')} {a.get('year') or ''}. {a.get('title','')}. "
            f"{a.get('journal','')}.".split()
        )
        if a.get("doi"):
            cite += f" doi:{a['doi']}"
        p(f"| `{a['pmcid']}` | {licence_label(a)} | {cite} |")
    p("")
    rpath = os.path.join(src, "figures", "README.md")
    open(rpath, "w", encoding="utf-8", newline="\n").write("\n".join(r))
    print(f"wrote {rpath}")

    if args.annotate_notes:
        n = annotate_notes(src, pairs)
        print(f"annotated {n} notes with a Figures line")
    print(f"  notes with figures : {len(pairs)}")
    print(f"  notes with a stored image : {len(stored_notes)}")
    print(f"  figures listed     : {n_fig}  (charts: {n_charts})")
    print(f"  images stored      : {n_img} ({n_mb:.1f} MB)")


if __name__ == "__main__":
    main()
