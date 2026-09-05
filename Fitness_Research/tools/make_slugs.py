"""Turn video titles into stable note filenames.

Strips the clickbait scaffolding ("Science Explained", "What The Science Says")
so the filename says what the note is about, then guarantees uniqueness.
"""
import re
from pathlib import Path

HERE = Path(__file__).parent
TSV = HERE / "all_videos2.tsv"
IDS = [
    l.strip().lstrip("﻿")
    for l in (HERE / "batch2_final.txt").read_text("utf-8-sig").splitlines()
    if l.strip()
]

# Filenames already used by the first 50 notes.
TAKEN = {
    "training-basics-and-theory", "training-volume-and-frequency", "rep-ranges-and-training-intensity",
    "choosing-the-best-exercises", "rest-between-sets", "lifting-tempo-fast-vs-slow-reps",
    "training-volume-deep-dive-israetel", "junk-volume", "how-hard-to-train-proximity-to-failure",
    "periodization-for-bodybuilding", "deloads", "bro-splits-vs-higher-frequency",
    "push-pull-legs-routine", "high-frequency-full-body-training",
    "advanced-techniques-supersets-dropsets-eccentrics", "partial-range-of-motion",
    "chest-exercises-ranked", "back-exercises-ranked", "shoulder-exercises-ranked",
    "biceps-exercises-ranked", "triceps-exercises-ranked", "quad-exercises-ranked",
    "glute-exercises-ranked", "hamstring-training", "calf-training", "neck-and-trap-training",
    "forearm-training", "ab-and-core-training", "back-width-vs-thickness", "squat-technique",
    "bench-press-technique", "deadlift-technique", "romanian-deadlift-technique",
    "warm-up-and-mobility", "protein-for-muscle-growth", "protein-dose-per-day-and-per-meal",
    "muscle-protein-synthesis", "body-recomposition", "how-to-bulk", "how-to-get-lean",
    "nutrient-timing-around-training", "refeeds-and-diet-breaks",
    "metabolism-and-energy-expenditure", "supplements-that-work", "creatine",
    "cardio-for-fat-loss", "muscle-memory-and-detraining", "programming-for-powerlifting",
    "sex-differences-in-training", "strength-standards-by-training-age",
    "README", "SUMMARY", "RESEARCH-CITATIONS",
}

# Scaffolding to drop from titles.
NOISE = [
    r"\(?\bscience explained\b\)?", r"\(?\busing science\b\)?", r"\(?\baccording to science\b\)?",
    r"\(?\branked (?:by|using) science\b\)?", r"\(?\bwhat the science says\b\)?",
    r"\(?\bscience[- ]based\b\)?", r"\(?\bmyth busted with science\b\)?", r"\(?\bmyth busted\b\)?",
    r"\(?\btraining science explained\b\)?", r"\(?\bnutritional science explained\b\)?",
    r"\(?\boptimal training explained\b\)?", r"\(?\bfully explained\b\)?",
    r"\(?\b\d+ studies?\b\)?", r"\(?\bscience applied\b\)?", r"\|.*$", r"\(.*?\)", r"\[.*?\]",
    r"\bft\.?\b.*$", r"\bfeat\.?\b.*$", r"\bw/.*$",
]

STOP = {
    "the", "a", "an", "of", "for", "to", "in", "on", "and", "or", "is", "are", "you",
    "your", "my", "how", "what", "why", "should", "do", "does", "can", "it", "this",
    "that", "with", "at", "be", "i", "me", "really", "actually", "ever", "very",
}

rows = {}
for line in TSV.read_text("utf-8-sig", errors="replace").splitlines():
    parts = line.lstrip("﻿").split("\t")
    if len(parts) >= 3:
        rows[parts[0]] = parts[2]

def slug(title):
    t = title.lower()
    for pat in NOISE:
        t = re.sub(pat, " ", t, flags=re.I)
    t = re.sub(r"[^a-z0-9]+", " ", t).strip()
    words = [w for w in t.split() if w not in STOP]
    if not words:
        words = [w for w in re.sub(r"[^a-z0-9]+", " ", title.lower()).split()][:5]
    return "-".join(words[:7]) or "untitled"

used = set(TAKEN)
out = []
for vid in IDS:
    title = rows.get(vid, vid)
    base = slug(title)
    name, n = base, 2
    while name in used:
        name, n = f"{base}-{n}", n + 1
    used.add(name)
    out.append(f"{vid}\t{name}\t{title}")

(HERE / "batch2_map.tsv").write_text("\n".join(out), encoding="utf-8")
print(f"mapped {len(out)} videos")
print("\nsample:")
for line in out[:15]:
    v, s, t = line.split("\t")
    print(f"  {s}.md   <-  {t[:60]}")
