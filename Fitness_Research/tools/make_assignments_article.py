"""Turn a fetched article catalogue into a stable slug -> note-filename mapping.

Usage:
    python tools/make_assignments_article.py <index.json> <refs.json> <out.tsv>
                                             [--exclude exclude.txt]

The article-source cousin of make_assignments.py, and it exists for the same
reason: agents are never allowed to choose their own output filenames. Left to
themselves they pick different conventions, collide on similar titles, and you
end up with two notes for one article and none for another.

Output columns match sources/hoh/assignments.tsv:

    article-slug  note-filename.md  word-count  ref-count  title

The exclude file is a list of article slugs with a "#" reason on each line. It
is written by hand - deciding what is filler is judgement work and the one part
of this that should not be automated. What IS automated is the consequence: an
excluded slug gets no note, and nothing downstream has to remember why.
"""
import argparse
import io
import json
import re
from pathlib import Path

# SEO scaffolding that appears in a third of these titles and distinguishes
# nothing: leading counts ("10 Best..."), and the trailing keyword tail that
# WordPress plugins append after a colon or dash ("Symptoms, Causes & Treatment").
LEADING_COUNT = re.compile(r"^\s*(the\s+)?\d{1,2}\s+(?=best|\w)", re.I)
HOWTO = re.compile(r"^\s*how[- ]?to:?\s+", re.I)
NOISE = re.compile(
    r"(?i)\b(that are (very )?effective|with samples|complete guide|"
    r"complete plan|complete system|what works|and how to start|"
    r"a physician'?s guide to|the scientific guide to|"
    r"an evidence[- ]based guide)\b")
PAREN = re.compile(r"\([^)]*\)")

STOP = {"a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does",
        "for", "from", "how", "in", "is", "it", "its", "my", "of", "on", "or",
        "s", "so", "than", "that", "the", "their", "them", "these", "this",
        "to", "up", "was", "we", "what", "when", "why", "with", "you", "your",
        "should", "really", "will"}

# The site's own metadata is wrong in a few places - a copy-paste of another
# article's Yoast title, most obviously. Corrected here rather than silently
# filed under the wrong name.
TITLE_FIX = {
    "how-to-eat-a-healthy-diet": "How to Eat a Healthy Diet",
    "584-2": "To Be A Beast",
    "4196-2": "From the Newsletter: A Word on Salt",
}


def slugify(title, maxwords=7):
    t = title.lower().replace("’", "'").replace("‘", "'")
    t = PAREN.sub(" ", t)
    t = NOISE.sub(" ", t)
    t = HOWTO.sub("", t)
    t = LEADING_COUNT.sub("", t)
    t = t.replace("&", " and ")
    t = re.sub(r"[^a-z0-9]+", " ", t)
    words = [w for w in t.split() if w and w not in STOP]
    # "To Be A Beast" is all stopwords bar one, and "beast.md" says nothing.
    # Below two surviving words, keep the title as written instead.
    if len(words) < 2:
        words = re.sub(r"[^a-z0-9]+", " ", title.lower()).split()[:5]
    return "-".join(words[:maxwords]) or "untitled"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("index")
    ap.add_argument("refs")
    ap.add_argument("out")
    ap.add_argument("--exclude", default=None)
    a = ap.parse_args()

    rows_in = json.loads(io.open(a.index, encoding="utf-8-sig").read())
    refs = json.loads(io.open(a.refs, encoding="utf-8-sig").read())

    excluded = {}
    if a.exclude and Path(a.exclude).exists():
        for line in io.open(a.exclude, encoding="utf-8-sig"):
            line = line.rstrip("\n")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            slug, _, why = line.partition("#")
            excluded[slug.strip()] = why.strip()

    rows, seen = [], {}
    unknown = [s for s in excluded if s not in {r["slug"] for r in rows_in}]
    for rec in sorted(rows_in, key=lambda r: r["slug"]):
        slug = rec["slug"]
        if slug in excluded:
            continue
        title = TITLE_FIX.get(slug, rec.get("title") or slug)
        base = slugify(title)
        name, n = base, 2
        while name in seen:
            name, n = "%s-%d" % (base, n), n + 1
        seen[name] = slug
        v = refs.get(slug, {})
        rows.append((slug, name + ".md", str(rec.get("words", 0)),
                     str(len(v.get("refs", []))), title))

    rows.sort(key=lambda r: -int(r[2]))
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    io.open(a.out, "w", encoding="utf-8", newline="\n").write(
        "\n".join("\t".join(r) for r in rows) + "\n")

    print("%d articles, %d excluded, %d notes assigned"
          % (len(rows_in), len(excluded), len(rows)))
    print("duplicate filenames: %d" % (len(rows) - len({r[1] for r in rows})))
    if unknown:
        print("exclude.txt names %d slugs not in the catalogue: %s"
              % (len(unknown), ", ".join(sorted(unknown))))
    long_names = [r[1] for r in rows if len(r[1]) > 60]
    if long_names:
        print("%d filenames over 60 chars" % len(long_names))


main()
