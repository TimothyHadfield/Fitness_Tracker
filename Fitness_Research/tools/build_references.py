"""Write a References section onto every note, plus the master bibliography.

Covers the whole library now: the original 50 plus the 248-video catalogue pass.
Everything is generated from data, never inferred - the topic headings are
Nippard's own from each video description, and citation text comes from PubMed.
Non-PubMed links are printed as the bare link he gave.
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
NOTES = Path(
    r"C:\Users\timha\OneDrive\Desktop\my-website\Code Projects"
    r"\Fitness_Tracker\Fitness_Research\Jeff Nippard videos"
)
DATA = json.loads((HERE / "citations.json").read_text("utf-8"))
PMID = re.compile(r"(?:pubmed\.ncbi\.nlm\.nih\.gov/|ncbi\.nlm\.nih\.gov/pubmed/)(\d+)")

# The original 50.
BATCH1 = {
    "TN9i9Ni0Xr4": "training-basics-and-theory", "7S0NjKYlJ7I": "training-volume-and-frequency",
    "3JOEZb46-dM": "rep-ranges-and-training-intensity", "vyiQw-qiv80": "choosing-the-best-exercises",
    "NR94rNsArv0": "rest-between-sets", "TQxMvpe2lQ8": "lifting-tempo-fast-vs-slow-reps",
    "2kwl5LiuCs4": "training-volume-deep-dive-israetel", "ekQxEEjYLDI": "junk-volume",
    "deDlhPmT2SY": "how-hard-to-train-proximity-to-failure", "1KWsgdDX79w": "periodization-for-bodybuilding",
    "LT_aBQatj5s": "deloads", "6PgsKMDUExE": "bro-splits-vs-higher-frequency",
    "qVek72z3F1U": "push-pull-legs-routine", "eTxO5ZMxcsc": "high-frequency-full-body-training",
    "Ri0v5-osLCQ": "advanced-techniques-supersets-dropsets-eccentrics",
    "jkaU-mM24_o": "partial-range-of-motion", "fGm-ef-4PVk": "chest-exercises-ranked",
    "jLvqKgW-_G8": "back-exercises-ranked", "SgyUoY0IZ7A": "shoulder-exercises-ranked",
    "GNO4OtYoCYk": "biceps-exercises-ranked", "OpRMRhr0Ycc": "triceps-exercises-ranked",
    "kIXcoivzGf8": "quad-exercises-ranked", "3ryh7PNhz3E": "glute-exercises-ranked",
    "0a_fVS2s4Ho": "hamstring-training", "21inrjhoFkQ": "calf-training",
    "q7MCjaJ02eQ": "neck-and-trap-training", "MfMxT_jXcPE": "forearm-training",
    "1G0y8D5rFDc": "ab-and-core-training", "PAXkl-AdJFg": "back-width-vs-thickness",
    "bEv6CCg2BC8": "squat-technique", "vcBig73ojpE": "bench-press-technique",
    "VL5Ab0T07e4": "deadlift-technique", "_oyxCn2iSjU": "romanian-deadlift-technique",
    "E81GN-3A8XM": "warm-up-and-mobility", "Pok0Jg2JAkE": "protein-for-muscle-growth",
    "wRehf1L231Q": "protein-dose-per-day-and-per-meal", "_otSunLL8AU": "muscle-protein-synthesis",
    "M4K0s792wAU": "body-recomposition", "OqRvmJ2eyBA": "how-to-bulk",
    "d8V9ZaSq9Oc": "how-to-get-lean", "PM8kiHcAD7Q": "nutrient-timing-around-training",
    "8HVdLMnr40M": "refeeds-and-diet-breaks", "g9QGQJ1ypp0": "metabolism-and-energy-expenditure",
    "IR5jW9iNNiw": "supplements-that-work", "QSPmsqYRL2Y": "creatine",
    "crPb62o-z_E": "cardio-for-fat-loss", "FNMssiTT2B0": "muscle-memory-and-detraining",
    "LDdx0YuDh-I": "programming-for-powerlifting", "NoUhE8TAGKM": "sex-differences-in-training",
    "LrDJXIQ_-eg": "strength-standards-by-training-age",
}

VIDEO_TO_NOTE = dict(BATCH1)
for line in (HERE / "batch2_map.tsv").read_text("utf-8").splitlines():
    parts = line.split("\t")
    if len(parts) >= 2:
        VIDEO_TO_NOTE[parts[0]] = parts[1]

NON_PAPER = {
    "massmember.com": "MASS Research Review (paywalled)",
    "weightology.net": "Weightology (paywalled)",
    "lookgreatnaked.com": "Schoenfeld's blog",
    "examine.com": "Examine.com",
    "researchgate.net": "ResearchGate",
}


EXTRA_PATH = HERE / "extra_citations.json"
EXTRA = json.loads(EXTRA_PATH.read_text("utf-8")) if EXTRA_PATH.exists() else {}


def render(url):
    # PMC / DOI links resolved separately (Crossref + NCBI ID converter).
    e = EXTRA.get(url)
    if e:
        head = " ".join(b for b in [e["authors"], e["year"]] if b)
        journal = f" *{e['journal']}*." if e["journal"] else ""
        bits = []
        if e.get("pmid"):
            bits.append(f"[PubMed](https://pubmed.ncbi.nlm.nih.gov/{e['pmid']}/)")
        else:
            bits.append(f"<{url}>")
        if e.get("doi"):
            bits.append(f"doi:[{e['doi']}](https://doi.org/{e['doi']})")
        return f"{head}. {e['title']}.{journal} " + " ".join(bits)

    m = PMID.search(url)
    if m:
        c = DATA["pmids"].get(m.group(1))
        if c:
            head = " ".join(b for b in [c["authors"], c["year"]] if b)
            doi = f" doi:[{c['doi']}](https://doi.org/{c['doi']})" if c["doi"] else ""
            journal = f" *{c['journal']}*." if c["journal"] else ""
            return f"{head}. {c['title']}.{journal} [PubMed]({url}){doi}"
        return f"[PubMed {m.group(1)}]({url})"
    for host, label in NON_PAPER.items():
        if host in url:
            return f"{label} — <{url}>"
    return f"<{url}>"


master = [
    "# Research cited across the Jeff Nippard notes",
    "",
    "Every citation Nippard listed in his own video descriptions, grouped under his own",
    "topic headings. PubMed links are resolved to full citations with DOIs; everything else",
    "is reproduced as the link he gave.",
    "",
    "**What this is and isn't.** These are the sources *he* listed for each video as a whole.",
    "Where a heading makes the mapping obvious (\"Rep Speed:\", \"Protein Distribution:\") it is a",
    "reliable claim-to-source link. Where a video's references are ungrouped, treat them as the",
    "reading list for that video rather than proof of any single sentence.",
    "",
]

written = no_refs = 0
for vid, slug in sorted(VIDEO_TO_NOTE.items(), key=lambda kv: kv[1]):
    note = NOTES / f"{slug}.md"
    if not note.exists():
        continue
    groups = [g for g in (DATA["per_video"].get(vid) or []) if g["links"]]
    if not groups:
        no_refs += 1
        block = (
            "\n## References\n\n"
            "Nippard listed no citations in this video's description. Any studies named in the "
            "note above are as he spoke them on camera and have not been resolved to papers.\n"
        )
    else:
        lines = ["\n## References\n", "Sources as listed by Nippard in the video description.\n"]
        for g in groups:
            topic = g["topic"]
            if topic and topic.lower() not in ("(ungrouped)", "references"):
                lines += [f"**{topic}**", ""]
            lines += [f"- {render(u)}" for u in g["links"]]
            lines.append("")
        block = "\n".join(lines)

    text = re.split(r"\n## References\n", note.read_text("utf-8"))[0].rstrip() + "\n"
    note.write_text(text + block, encoding="utf-8")
    written += 1

    master += [f"## [{slug}]({slug}.md)", ""]
    if not groups:
        master += ["*No citations listed in the video description.*", ""]
    else:
        for g in groups:
            topic = g["topic"]
            if topic and topic.lower() not in ("(ungrouped)", "references"):
                master += [f"**{topic}**", ""]
            master += [f"- {render(u)}" for u in g["links"]]
            master.append("")

(NOTES / "RESEARCH-CITATIONS.md").write_text("\n".join(master), encoding="utf-8")
print(f"notes updated: {written}")
print(f"of which had no listed citations: {no_refs}")
