"""Pull the reference block out of each YouTube description.

Nippard groups his citations under his own topic headers ("Rep Speed:",
"Training Volume Meta-Analyses:"), which is a far more reliable claim->source
mapping than anything we could infer. Keep the headers with the links.
"""
import re
from pathlib import Path

SRC = Path(__file__).parent / "desc"
OUT = Path(__file__).parent / "refs"
OUT.mkdir(exist_ok=True)

SCHOLARLY = re.compile(
    r"https?://(?:www\.)?("
    r"researchgate|pubmed|ncbi\.nlm|sciencedirect|doi\.org|dx\.doi|link\.springer"
    r"|journals\.|academic\.oup|onlinelibrary|tandfonline|frontiersin|mdpi"
    r"|physiology\.org|jstage|bjsm|jissn|biomedcentral|nature\.com|cell\.com"
    r"|weightology|lookgreatnaked|massmember|examine\.com|jospt|nsca|acsm"
    r"|karger|wiley|jamanetwork|nejm|thelancet|oup\.com|sagepub|liebertpub"
    r")[^\s\)]*",
    re.I,
)

# Lines that mean the citation block is over.
STOP = re.compile(
    r"^\s*(music|follow me|about me|disclaim|instagram|snapchat|facebook|twitter"
    r"|podcast|edited by|filmed by|help support|my programs|check out|thumbnail"
    r"|shot by|intro|outro)\b",
    re.I,
)

# A short line ending in ':' just above links is one of his topic headers.
HEADER = re.compile(r"^\s*([A-Z0-9][^:\n]{2,80}):\s*$")


def blocks(text):
    """[(header or None, [links])] in document order."""
    out, header, bucket = [], None, []
    for raw in text.splitlines():
        line = raw.strip()
        if STOP.match(line):
            if bucket:
                out.append((header, bucket))
                header, bucket = None, []
            continue
        links = SCHOLARLY.findall(line)
        full = SCHOLARLY.search(line)
        if full:
            bucket.append(full.group(0).rstrip(".,;"))
            continue
        if line.startswith("http"):
            continue  # a non-scholarly url; ignore but don't break the group
        m = HEADER.match(line)
        if m:
            if bucket:
                out.append((header, bucket))
                bucket = []
            header = m.group(1).strip()
        elif not line and bucket:
            out.append((header, bucket))
            header, bucket = None, []
    if bucket:
        out.append((header, bucket))
    return out


total_links = 0
for f in sorted(SRC.glob("*.description")):
    text = f.read_text("utf-8", errors="replace")
    grouped = [(h, ls) for h, ls in blocks(text) if ls]
    if not grouped:
        continue
    lines = []
    for header, links in grouped:
        lines.append(f"### {header}" if header else "### (ungrouped)")
        for l in dict.fromkeys(links):  # dedupe, keep order
            lines.append(f"- {l}")
            total_links += 1
        lines.append("")
    (OUT / f"{f.stem.replace('.description','')}.md").write_text(
        "\n".join(lines), encoding="utf-8"
    )

files = list(OUT.glob("*.md"))
print(f"videos with extracted refs: {len(files)}")
print(f"total links: {total_links}")
