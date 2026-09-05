"""Pull a YouTube transcript to plain text.

Usage:  python tools/fetch_transcript.py <url-or-video-id> [outdir]

Needs yt-dlp (pip install -U yt-dlp). Writes <outdir>/<video-id>.md with the
title, channel, date and URL in the header and the de-duplicated caption text
below it. Timestamps are kept every ~30s so a claim can be traced back.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

TS = re.compile(r"^(\d\d):(\d\d):(\d\d)\.\d\d\d --> ")
TAG = re.compile(r"<[^>]+>")


def parse_vtt(text):
    """VTT -> [(seconds, line)], dropping the rolling-caption duplicates."""
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
    """Join into paragraphs, dropping a [mm:ss] marker in every so often."""
    chunks, buf, mark = [], [], None
    for sec, line in lines:
        if mark is None:
            mark = sec
        buf.append(line)
        if sec - mark >= stamp_every and len(buf) > 4:
            chunks.append(f"[{mark // 60:02d}:{mark % 60:02d}] " + " ".join(buf))
            buf, mark = [], sec
    if buf:
        chunks.append(f"[{(mark or 0) // 60:02d}:{(mark or 0) % 60:02d}] " + " ".join(buf))
    return "\n\n".join(chunks)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    url = sys.argv[1]
    outdir = Path(sys.argv[2] if len(sys.argv) > 2 else "transcripts")
    outdir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        # No check=True: YouTube rate-limits (429) the second caption track on
        # repeat pulls, and one track is all we need.
        subprocess.run(
            ["yt-dlp", "--skip-download", "--write-auto-subs", "--write-subs",
             "--sub-langs", "en.*", "--sub-format", "vtt", "--write-info-json",
             "-o", f"{tmp}/%(id)s.%(ext)s", url],
        )
        tmp = Path(tmp)
        meta = next(tmp.glob("*.info.json"), None)
        if meta is None:
            sys.exit("yt-dlp could not reach the video")
        info = json.loads(meta.read_text("utf-8"))
        vtts = sorted(tmp.glob("*.vtt"), key=lambda p: "orig" not in p.name)
        if not vtts:
            sys.exit("no English captions available for this video")
        body = collapse(parse_vtt(vtts[0].read_text("utf-8", errors="replace")))

    d = info.get("upload_date", "")
    header = (
        f"# {info.get('title', '')}\n\n"
        f"- Channel: {info.get('uploader', '')}\n"
        f"- Published: {d[:4]}-{d[4:6]}-{d[6:]}\n"
        f"- Length: {info.get('duration', 0) // 60} min\n"
        f"- URL: https://www.youtube.com/watch?v={info['id']}\n\n"
        "---\n\n"
    )
    dest = outdir / f"{info['id']}.md"
    dest.write_text(header + body + "\n", encoding="utf-8")
    print(dest)


if __name__ == "__main__":
    main()
