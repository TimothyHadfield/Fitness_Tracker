"""Build README.md for the Menno Henselmans notes folder.

Groups every note by topic using the note's own `**Topic:**` line where present,
falling back to keyword rules on the title. Verifies coverage against
assignments.tsv so nothing is silently dropped.
"""
import io, json, os, re, sys, collections

BASE = r"c:\Users\timha\OneDrive\Desktop\my-website\Code Projects\Fitness_Tracker\Fitness_Research"
NOTES = os.path.join(BASE, "Menno Henselmans videos")
SRC = os.path.join(BASE, "sources", "menno")

rows = []
for line in io.open(os.path.join(SRC, "assignments.tsv"), encoding="utf-8"):
    p = line.rstrip("\n").split("\t")
    if len(p) >= 5:
        rows.append({"id": p[0], "file": p[1], "min": int(p[2]),
                     "refs": int(p[3]), "title": p[4]})

# Keyword routing. Order matters - first match wins.
RULES = [
 ("Volume, frequency and effort",
  r"volume|failure|junk|deload|recover|fatigue|cns|overtrain|sets|proximity|"
  r"intermediate plateau|newbie gains|swelling|more gym time"),
 ("Exercise selection and technique",
  r"exercise|squat|bench|press|curl|biceps|triceps|delt|shoulder|back|quad|"
  r"hamstring|calf|abs|grip|pull|push-?up|row|machine|leg extension|valgus|"
  r"technique|arms|glute|lunge|hamstrings|fiber types"),
 ("Programming and splits",
  r"split|program|periodi|texas|5x5|chatgpt|tempo|rep range|rest between|"
  r"reps for max|training concepts|time-?efficient|crossfit|mentzer"),
 ("Protein and macronutrients",
  r"protein|carb|macro|amino|satiat|absorb"),
 ("Fat loss and body composition",
  r"fat loss|lose fat|cut|bulk|shred|sixpack|six pack|body fat|diet break|"
  r"maingain|willpower|ozempic|obesity|dieting|physique according|jacked"),
 ("Supplements",
  r"supplement|caffeine|creatine|collagen|peptide|electrolyte|sweetener|"
  r"pre-?workout|sleep|organic"),
 ("Hormones, drugs and physiology",
  r"testosterone|trt|steroid|natty|natties|hormone|muscle grow|women recover|"
  r"skin|ice bath|sauna|soreness|posture|injury|elbow|disc|ramadan|"
  r"transgender|finnish"),
 ("Myths, evidence and method",
  r"myth|broscience|science-?based|debunk|wrong|studies|study|evidence|"
  r"reality check|lessons|mistakes|talking about|theory"),
]

def topic_of(rec):
    path = os.path.join(NOTES, rec["file"])
    if os.path.exists(path):
        head = io.open(path, encoding="utf-8-sig").read(1500)
        m = re.search(r"^\*\*Topic:\*\*\s*(.+)$", head, re.M)
        if m:
            t = m.group(1).strip().strip("*").split("·")[0].strip()
            low = t.lower()
            if "suppl" in low: return "Supplements"
            if "nutri" in low: return "Protein and macronutrients"
            if "physio" in low: return "Hormones, drugs and physiology"
            if "psych" in low or "behav" in low: return "Fat loss and body composition"
            if "evidence" in low or "method" in low: return "Myths, evidence and method"
    blob = (rec["title"] + " " + rec["file"]).lower()
    for name, pat in RULES:
        if re.search(pat, blob):
            return name
    return "Myths, evidence and method"

groups = collections.OrderedDict((n, []) for n, _ in RULES)
for rec in rows:
    groups.setdefault(topic_of(rec), []).append(rec)

def h1(fn):
    p = os.path.join(NOTES, fn)
    if not os.path.exists(p):
        return None
    return io.open(p, encoding="utf-8-sig").readline().lstrip("#").strip()

total = sum(len(v) for v in groups.values())
missing = [r["file"] for r in rows if not os.path.exists(os.path.join(NOTES, r["file"]))]

out = ["""# Menno Henselmans - video notes

Notes on %d videos from Menno Henselmans's YouTube channel: a former business analyst turned
physique coach and researcher who publishes on training and nutrition, and who is markedly more
willing than most of this library's sources to argue against the evidence-based consensus.

That is why he is here. Where he disagrees with the mainstream position - and he does, on
caffeine tolerance, on protein in a deficit, on warm-ups, on rest-interval floors, on whether
volume ceilings exist at all - the notes say so explicitly rather than smoothing it into
agreement. Several notes carry a marked comparison against the position held elsewhere in this
library.

His videos are short and tightly scripted, mostly 5-15 minutes, and the notes are sized to match:
a five-minute video making one claim gets a short note.

**References come from his video descriptions**, where 119 of 159 carry a `Reference:` block.
Unlike Jeff Nippard he almost never groups those references by topic, so the claim-to-source
mapping is weaker - the notes link a claim to a paper only where the mapping is unambiguous, and
leave it unlinked rather than guess. The full bibliography is
[RESEARCH-CITATIONS.md](RESEARCH-CITATIONS.md).

Eight videos were excluded as personal or off-topic rather than research content: a Q&A about his
personal life, an account of being hacked, investing advice, life-perspective and happiness
videos, a response to another creator, and a video about fit-shaming.

## Start here

**[SUMMARY.md](SUMMARY.md)** - the whole channel in one file, organised by decision, including a
section on every point where he departs from the consensus this library otherwise records.

---

## Every note
""" % total]

for name, recs in groups.items():
    if not recs:
        continue
    recs.sort(key=lambda r: -r["min"])
    out.append("\n### %s (%d)\n" % (name, len(recs)))
    for r in recs:
        t = h1(r["file"])
        if t is None:
            continue
        ref = " · %d refs" % r["refs"] if r["refs"] else ""
        out.append("- [%s](%s)  \n  *%d min%s*" % (t, r["file"], r["min"], ref))
    out.append("")

out.append("""
---

Notes written from the videos' caption tracks with `tools/fetch_channel.py`; references extracted
from the descriptions with `tools/extract_refs_desc.py` and resolved against PubMed, the NCBI ID
converter and Crossref with `tools/resolve_refs.py`.

These are notes, not transcripts, and they do not reproduce his text. If you want his exact
words, watch the video.
""")

io.open(os.path.join(NOTES, "README.md"), "w", encoding="utf-8",
        newline="\n").write("\n".join(out))
print("wrote README.md: %d notes across %d sections" %
      (total, sum(1 for v in groups.values() if v)))
if missing:
    print("NOT YET WRITTEN (%d): %s" % (len(missing), ", ".join(missing)))
