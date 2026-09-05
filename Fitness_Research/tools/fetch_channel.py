"""Fetch a whole channel's captions and descriptions, resumably.

Usage:
    python tools/fetch_channel.py <channel-url> <outdir> [--min-seconds 300]
                                  [--delay 1.5] [--limit N]

Two passes. First it lists the catalogue to <outdir>/manifest.json. Then it walks
that list and, for each video not already on disk, pulls the caption track and the
description in ONE yt-dlp call - the info.json carries both, so there is no reason
to hit the video twice.

Written to survive being killed. Anything already written is skipped on restart,
and videos that fail are recorded in failures.json so a later pass can retry them
with a longer delay rather than starting over.

YouTube rate-limits hard. Fetch sequentially. The listing endpoint and the caption
endpoint rate-limit separately, so a failed caption download does NOT mean the
video has no captions - retry it with a bigger delay before believing that.
"""
import argparse
import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

TS = re.compile(r"^(\d\d):(\d\d):(\d\d)\.\d\d\d --> ")
TAG = re.compile(r"<[^>]+>")


def parse_vtt(text):
    out, seen, cur = [], None, 0
    for raw in text.splitlines():
        m = TS.match(raw)
        if m:
            h, mi, s = (int(g) for g in m.groups())
            cur = h * 3600 + mi * 60 + s
            continue
        line = TAG.sub("", raw).strip()
        if not line or line.startswith(("WEBVTT", "Kind:", "Language:")):
            continue
        if line == seen:
            continue
        seen = line
        out.append((cur, line))
    return out


def collapse(lines, stamp_every=30):
    chunks, buf, mark = [], [], None
    for sec, line in lines:
        if mark is None:
            mark = sec
        buf.append(line)
        if sec - mark >= stamp_every and len(buf) > 4:
            chunks.append("[%02d:%02d] " % (mark // 60, mark % 60) + " ".join(buf))
            buf, mark = [], sec
    if buf:
        m = mark or 0
        chunks.append("[%02d:%02d] " % (m // 60, m % 60) + " ".join(buf))
    return "\n\n".join(chunks)


def catalogue(url, outdir):
    """List the channel once and cache it. Cheap to redo, expensive to lose."""
    man = outdir / "manifest.json"
    if man.exists():
        return json.loads(man.read_text("utf-8"))
    p = subprocess.run(
        ["yt-dlp", "--flat-playlist", "--ignore-errors",
         "--print", "%(id)s\t%(duration)s\t%(upload_date)s\t%(title)s", url],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    vids = []
    for line in p.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) >= 4 and len(parts[0]) == 11:
            try:
                dur = int(float(parts[1]))
            except ValueError:
                dur = 0
            vids.append({"id": parts[0], "duration": dur,
                         "date": parts[2], "title": "\t".join(parts[3:])})
    man.write_text(json.dumps(vids, indent=1), encoding="utf-8")
    return vids


def fetch_one(vid, outdir):
    """One yt-dlp call gets captions and the description together."""
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            ["yt-dlp", "--skip-download", "--write-auto-subs", "--write-subs",
             "--sub-langs", "en.*", "--sub-format", "vtt", "--write-info-json",
             "--no-warnings", "-o", "%s/%%(id)s.%%(ext)s" % tmp,
             "https://www.youtube.com/watch?v=" + vid],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
        tmp = Path(tmp)
        meta = next(tmp.glob("*.info.json"), None)
        if meta is None:
            return "unreachable"
        info = json.loads(meta.read_text("utf-8"))

        # The description is worth keeping even when the captions fail - it is
        # where the reference list lives, and it is the half we cannot rebuild.
        desc = info.get("description") or ""
        (outdir / "descriptions").mkdir(exist_ok=True)
        (outdir / "descriptions" / (vid + ".txt")).write_text(desc, encoding="utf-8")

        vtts = sorted(tmp.glob("*.vtt"), key=lambda p: "orig" not in p.name)
        if not vtts:
            return "no-captions"
        body = collapse(parse_vtt(vtts[0].read_text("utf-8", errors="replace")))

    d = info.get("upload_date", "")
    header = (
        "# %s\n\n"
        "- Channel: %s\n- Published: %s-%s-%s\n- Length: %d min\n"
        "- URL: https://www.youtube.com/watch?v=%s\n\n---\n\n"
        % (info.get("title", ""), info.get("uploader", ""),
           d[:4], d[4:6], d[6:], info.get("duration", 0) // 60, info["id"]))
    (outdir / (vid + ".md")).write_text(header + body + "\n", encoding="utf-8")
    return "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("outdir")
    ap.add_argument("--min-seconds", type=int, default=300)
    ap.add_argument("--delay", type=float, default=1.5)
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    outdir = Path(a.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    vids = catalogue(a.url, outdir)
    keep = [v for v in vids if v["duration"] >= a.min_seconds]
    if a.limit:
        keep = keep[:a.limit]
    sys.stderr.write("catalogue: %d videos, %d over %ds\n"
                     % (len(vids), len(keep), a.min_seconds))

    fails = {}
    fpath = outdir / "failures.json"
    if fpath.exists():
        fails = json.loads(fpath.read_text("utf-8"))

    done = skipped = 0
    for i, v in enumerate(keep):
        dest = outdir / (v["id"] + ".md")
        if dest.exists():
            skipped += 1
            continue
        time.sleep(a.delay)
        try:
            status = fetch_one(v["id"], outdir)
        except Exception as e:                      # noqa: BLE001 - keep going
            status = "error: %s" % e
        if status == "ok":
            done += 1
            fails.pop(v["id"], None)
        else:
            fails[v["id"]] = {"status": status, "title": v["title"]}
        if (i + 1) % 20 == 0:
            fpath.write_text(json.dumps(fails, indent=1), encoding="utf-8")
            sys.stderr.write("  %d/%d  ok=%d skip=%d fail=%d\n"
                             % (i + 1, len(keep), done, skipped, len(fails)))

    fpath.write_text(json.dumps(fails, indent=1), encoding="utf-8")
    sys.stderr.write("DONE ok=%d skipped=%d failed=%d\n" % (done, skipped, len(fails)))


if __name__ == "__main__":
    main()
