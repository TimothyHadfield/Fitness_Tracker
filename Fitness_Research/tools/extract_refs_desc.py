"""Pull the reference block out of each video description.

Usage:  python tools/extract_refs_desc.py <descriptions-dir> <out.json>

Creators who cite put the links under a heading - "Reference:", "References:",
"Studies:" - somewhere near the bottom, above the hashtags. This finds that block
and keeps the scientific URLs from it.

Two things it deliberately does NOT do:

- It does not treat every URL in the description as a reference. Descriptions are
  full of the creator's own funnel links, affiliate codes and social handles, and
  sweeping those into a bibliography would be worse than having none.
- It does not guess when there is no heading. If a description has scientific URLs
  but no reference block, those are recorded separately as "loose" so a human can
  decide, rather than being silently promoted to citations.
"""
import argparse
import io
import json
import re
from pathlib import Path

# Heading forms seen in the wild: "References:", "*Reference*", "Ref:", "**Sources**".
# The asterisks are the creator's own emphasis markers, not markdown we control.
HEADING = re.compile(
    r"^[^\S\n]*[*_]{0,2}(references?|refs?|sources?|studies|citations?|literature|"
    r"scientific articles?|papers?)[*_]{0,2}[^\S\n]*:?[^\S\n]*$", re.I | re.M)

# "Study: https://..." on one line - a heading and its single reference together.
INLINE = re.compile(
    r"^[^\S\n]*[*_]{0,2}(?:study|studies|reference|ref|source|paper)[*_]{0,2}[^\S\n]*:"
    r"[^\S\n]*(https?://\S+)", re.I | re.M)

URL = re.compile(r"https?://[^\s)>\]\"']+")

# Hosts that are the creator talking about themselves, not citing anyone.
SELF = re.compile(
    r"youtube\.com|youtu\.be|instagram\.com|facebook\.com|twitter\.com|x\.com|"
    r"tiktok\.com|patreon\.com|spotify\.com|apple\.com|amazon\.|amzn\.to|"
    r"linktr\.ee|bit\.ly|discord|reddit\.com|threads\.net", re.I)

SCIENTIFIC = re.compile(
    r"pubmed|ncbi\.nlm\.nih\.gov|doi\.org|/pmc/|researchgate|sciencedirect|"
    r"link\.springer|springer\.com|journals\.lww|lww\.com|tandfonline|wiley|"
    r"frontiersin|mdpi\.com|biomedcentral|physiology\.org|sagepub|nature\.com|"
    r"academic\.oup\.com|sportrxiv|biorxiv|medrxiv|jamanetwork|nejm\.org|"
    r"bmj\.com|cambridge\.org|karger\.com|thieme|liebertpub|"
    r"actamedicamediterranea|nih\.gov|cochrane|"
    # Elsevier's own resolver, which is what "share this article" produces and
    # which does not contain the string "sciencedirect" at all.
    r"linkinghub\.elsevier|elsevier\.com|"
    r"humankinetics|jssm\.org|journals\.humankinetics|"
    r"onlinelibrary|iopscience|ahajournals|diabetesjournals|"
    r"aspetjournals|apa\.org|psycnet|jamanetwork|"
    r"scielo|hindawi|plos|peerj|f1000|"
    r"nutrition\.org|ajcn|clinicalnutrition|"
    r"europepmc|semanticscholar|osf\.io|preprints\.org|"
    r"cdnsciencepub|ovid\.com|esmed\.org|proquest|karger|"
    # Not journals, but sources creators genuinely cite and a reader can follow.
    r"weightology\.net|strongerbyscience\.com", re.I)

TRAILING_PUNCT = re.compile(r"[.,;:]+$")


def clean_url(u):
    u = TRAILING_PUNCT.sub("", u.strip())
    # yt-dlp descriptions sometimes wrap; strip a stray closing bracket.
    while u and u[-1] in ")]}”’":
        u = u[:-1]
    return u


def block_after_heading(text):
    """Everything from the last reference heading to the hashtags or the end."""
    matches = list(HEADING.finditer(text))
    if not matches:
        return None
    start = matches[-1].end()
    rest = text[start:]
    # Stop at a hashtag wall, which is where descriptions end.
    stop = re.search(r"^\s*#\w", rest, re.M)
    if stop:
        rest = rest[:stop.start()]
    return rest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("descdir")
    ap.add_argument("out")
    a = ap.parse_args()

    out = {}
    n_block = n_loose = n_none = 0
    for f in sorted(Path(a.descdir).glob("*.txt")):
        vid = f.stem
        text = io.open(f, encoding="utf-8").read()
        block = block_after_heading(text)

        refs, loose, groups = [], [], []
        if block is not None:
            # Walk the block line by line so that a bare line of text sitting
            # above a run of links is kept as that run's label. Where a creator
            # does this, it is their own claim-to-source mapping and it is worth
            # more than anything we could infer from the transcript.
            label = ""
            for line in block.splitlines():
                urls = [clean_url(u) for u in URL.findall(line)]
                urls = [u for u in urls
                        if not SELF.search(u) and SCIENTIFIC.search(u)]
                if urls:
                    if not groups or groups[-1]["label"] != label:
                        groups.append({"label": label, "urls": []})
                    for u in urls:
                        groups[-1]["urls"].append(u)
                        if u not in refs:
                            refs.append(u)
                elif URL.search(line):
                    continue          # a self/promo link - not a new label
                else:
                    t = line.strip().strip("*_-–—:").strip()
                    # A label, not prose: short, and not a timestamp line.
                    if t and len(t) < 90 and not re.match(r"^\d+:\d\d", t):
                        label = t
                    elif not t:
                        label = ""

        for m in INLINE.finditer(text):
            u = clean_url(m.group(1))
            if not SELF.search(u) and SCIENTIFIC.search(u) and u not in refs:
                refs.append(u)
                groups.append({"label": "", "urls": [u]})
        # Anything scientific outside the block, recorded but not promoted.
        for u in URL.findall(text):
            u = clean_url(u)
            if SELF.search(u) or not SCIENTIFIC.search(u):
                continue
            if u not in refs and u not in loose:
                loose.append(u)

        if refs:
            n_block += 1
        elif loose:
            n_loose += 1
        else:
            n_none += 1
        out[vid] = {"refs": refs, "loose": loose, "groups": groups,
                    "has_heading": block is not None}

    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    io.open(a.out, "w", encoding="utf-8").write(json.dumps(out, indent=1))

    total = sum(len(v["refs"]) for v in out.values())
    uniq = len({u for v in out.values() for u in v["refs"]})
    print("%d descriptions: %d with a reference block, %d with loose links only, "
          "%d with none" % (len(out), n_block, n_loose, n_none))
    print("%d references extracted, %d unique" % (total, uniq))


main()
