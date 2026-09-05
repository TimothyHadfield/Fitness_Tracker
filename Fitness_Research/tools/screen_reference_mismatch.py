"""Flag notes whose reference TITLES look unrelated to the note's subject.

Earlier attempts failed two ways: a strict regex that choked on "et al." (so it
only screened 38 of 279 notes), and a heading-based screen that flagged generic
headings like "Timestamps" while missing every genuine mismatch.

This one parses titles properly and scores vocabulary overlap between each
reference title and the note body. Output is a review list, not a verdict.
"""
import re
from pathlib import Path

NOTES = Path(
    r"C:\Users\timha\OneDrive\Desktop\my-website\Code Projects"
    r"\Fitness_Tracker\Fitness_Research\Jeff Nippard videos"
)
SKIP = {"README.md", "SUMMARY.md", "RESEARCH-CITATIONS.md"}
YEAR_END = re.compile(r"\d{4}$")

STOP = set("""a an the of for to in on and or is are was were be been with at by from this
that these those it its as not no you your after before during between among versus more
most less high low higher lower increase increased decrease decreased effect effects
study studies research paper review systematic meta analysis randomized controlled trial
acute chronic response responses following comparison comparing does do did can could may
men women male female adults young healthy subjects participants human humans""".split())


def words(text):
    return {w for w in re.findall(r"[a-z]{4,}", text.lower()) if w not in STOP}


def titles_in(refs):
    """Pull the title out of '- Authors YEAR. Title. *Journal*. ...' lines."""
    out = []
    for line in refs.splitlines():
        line = line.strip()
        if not line.startswith("- "):
            continue
        segs = [s.strip() for s in line[2:].split(". ")]
        for i, seg in enumerate(segs[:-1]):
            if YEAR_END.search(seg):
                cand = segs[i + 1]
                if len(cand) > 15 and not cand.startswith("*"):
                    out.append(cand)
                break
    return out


rows = []
for note in sorted(NOTES.glob("*.md")):
    if note.name in SKIP:
        continue
    parts = note.read_text("utf-8", errors="replace").split("## References")
    if len(parts) < 2:
        continue
    body_words = words(parts[0])
    ts = titles_in(parts[1])
    if len(ts) < 2 or not body_words:
        continue
    scores = [len(words(t) & body_words) / max(len(words(t)), 1) for t in ts]
    related = sum(1 for s in scores if s >= 0.15)
    rows.append((related / len(ts), related, len(ts), note.name))

rows.sort()
print(f"{'frac':>6} {'rel':>4} {'refs':>5}  note")
print("-" * 76)
for frac, rel, n, name in rows[:20]:
    print(f"{frac:6.2f} {rel:4d} {n:5d}  {name}")
print(f"\nscreened {len(rows)} notes")
