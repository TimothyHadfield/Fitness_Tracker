"""Turn a fetched channel into a stable video-id -> note-filename mapping.

Usage:
    python tools/make_assignments.py <transcript-dir> <assignments.tsv>
                                     [--exclude ids.txt] [--refs refs.json]

Agents are never allowed to choose their own output filenames. Left to themselves
they pick different conventions, collide on similar titles, and you end up with
two notes for one video and none for another. So the mapping is decided here,
once, deterministically, and handed to them.

Slugs are built from the title, stripped of the clickbait scaffolding that carries
no information ("This is", "these are", bracketed [New study] tags), then truncated
at a word boundary and de-duplicated with a numeric suffix.
"""
import argparse
import io
import json
import re
from pathlib import Path

# Openers and tags that appear in a third of the titles and distinguish nothing.
NOISE = re.compile(
    r"^(this is (how|the|what|why)?|these are( the)?|here'?s( how| why)?|"
    r"the )\b", re.I)
BRACKET = re.compile(r"[\[\(](new )?(study|studies|science|research|review|"
                     r"\d{4})[^\]\)]*[\]\)]", re.I)
STOP = {"a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does",
        "for", "from", "how", "in", "is", "it", "its", "my", "of", "on", "or",
        "s", "so", "than", "that", "the", "their", "them", "these", "this",
        "to", "up", "was", "we", "what", "when", "why", "with", "you", "your"}


def slugify(title, maxwords=7):
    t = title.lower()
    t = t.replace("’", "'").replace("‘", "'")
    t = BRACKET.sub(" ", t)
    t = NOISE.sub("", t).strip()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    words = [w for w in t.split() if w and w not in STOP]
    if not words:
        words = [w for w in re.sub(r"[^a-z0-9]+", " ", title.lower()).split()][:4]
    return "-".join(words[:maxwords]) or "untitled"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tdir")
    ap.add_argument("out")
    ap.add_argument("--exclude", default=None)
    ap.add_argument("--refs", default=None)
    a = ap.parse_args()

    tdir = Path(a.tdir)
    manifest = {v["id"]: v for v in
                json.loads((tdir / "manifest.json").read_text("utf-8"))}
    have = sorted(p.stem for p in tdir.glob("*.md"))

    excluded = set()
    if a.exclude and Path(a.exclude).exists():
        for line in io.open(a.exclude, encoding="utf-8"):
            vid = line.split("#")[0].strip()
            if vid:
                excluded.add(vid)

    refs = {}
    if a.refs and Path(a.refs).exists():
        refs = json.loads(io.open(a.refs, encoding="utf-8").read())

    rows, seen = [], {}
    for vid in have:
        if vid in excluded or vid not in manifest:
            continue
        m = manifest[vid]
        base = slugify(m["title"])
        slug = base
        n = 2
        while slug in seen:
            slug = "%s-%d" % (base, n)
            n += 1
        seen[slug] = vid
        rows.append((vid, slug + ".md", str(m["duration"] // 60),
                     str(len(refs.get(vid, {}).get("refs", []))), m["title"]))

    rows.sort(key=lambda r: -int(r[2]))
    io.open(a.out, "w", encoding="utf-8", newline="\n").write(
        "\n".join("\t".join(r) for r in rows) + "\n")
    print("%d transcripts, %d excluded, %d notes assigned"
          % (len(have), len(excluded & set(have)), len(rows)))
    dupes = len(rows) - len({r[1] for r in rows})
    print("duplicate filenames: %d" % dupes)


main()
