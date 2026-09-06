"""Fetch a site's articles as markdown, resumably.

Usage:
    python tools/fetch_articles.py <sitemap-or-index-url> <outdir>
                                   [--delay 2] [--limit N] [--match REGEX]
    python tools/fetch_articles.py --index-only <outdir> --index-out <path.json>

Same shape as fetch_channel.py. Two passes: first it enumerates the catalogue
into <outdir>/manifest.json, then it walks that list and, for each article not
already on disk, pulls the page and reduces it to markdown.

The catalogue source can be an XML sitemap (<loc> entries) or an ordinary HTML
index page, in which case same-host links that look like articles are scraped.

Written to survive being killed. Anything already written is skipped on restart,
and pages that fail land in failures.json so a later pass can retry them with a
longer delay rather than starting over.

WHAT MATTERS IN THE OUTPUT
--------------------------
The inline reference links are the point of a source like this - they are the
creator's own claim-to-source mapping, the same role the description reference
block plays for a YouTube channel. So the extractor keeps every anchor as a
markdown link, keeps bare [n] markers in the prose verbatim, and never collapses
a numbered reference list into plain text. Site chrome, navigation, related-post
rails and store promos are dropped by class name; when in doubt the block is
kept, because losing a citation is worse than keeping a stray line.

Nothing here republishes anything: the output is local working material for
summarising, and transcripts/ is gitignored.
"""
import argparse
import gzip
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

UA = ("Mozilla/5.0 (compatible; fitness-research-reader/1.0; "
      "local research summarisation; contact via site owner)")

# Containers whose contents are chrome, not article. Matched against class/id.
CHROME = re.compile(
    r"related|share|sharing|social|newsletter|subscribe|signup|sign-up|opt-in|"
    r"promo|advert|banner|cta\b|product|woocommerce|add-to-cart|shop|store|"
    r"sidebar|widget|comment|breadcrumb|pagination|post-nav|nav-|menu|toc\b|"
    r"single-toc|author-box|author-bio|meta-info|tags|footer|header|masthead|"
    r"popup|modal|cookie|read-more|more-posts|you-may-also",
    re.I)

# Tags dropped outright, contents and all.
DROP = {"script", "style", "noscript", "svg", "form", "iframe", "button",
        "select", "textarea", "nav", "header", "footer", "aside", "template",
        "picture", "video", "audio", "canvas"}

BLOCK = {"p", "div", "section", "article", "ul", "ol", "li", "blockquote",
         "table", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "hr", "br",
         "figure", "figcaption", "dl", "dt", "dd"}

# Article body containers, most specific first. Extend for a new site.
CONTAINERS = ["bbm-single-content", "entry-content", "post-content",
              "article-content", "the-content"]


# --------------------------------------------------------------------------
# HTML -> markdown
# --------------------------------------------------------------------------

class ToMarkdown(HTMLParser):
    """Small, forgiving HTML-to-markdown reducer.

    Deliberately not a general converter. It keeps the things that carry
    meaning in an article - headings, paragraphs, lists, emphasis and above
    all links - and throws away layout.
    """

    def __init__(self, base_url=""):
        super().__init__(convert_charrefs=True)
        self.base = base_url
        self.out = []          # finished blocks
        self.buf = []          # current inline run
        self.drop = 0          # depth inside a dropped subtree
        self.href = None       # href of the open <a>
        self.atext = []        # text inside the open <a>
        self.lists = []        # stack of ("ul", n) / ("ol", n)
        self.pre = 0
        self.heading = None

    # -- helpers ----------------------------------------------------------

    def _flush(self, prefix=""):
        text = "".join(self.buf)
        self.buf = []
        text = re.sub(r"[ \t]+", " ", text).strip()
        text = re.sub(r"\s+([,.;:!?\)])", r"\1", text)
        if text:
            self.out.append(prefix + text)

    def _emit(self, s):
        (self.atext if self.href is not None else self.buf).append(s)

    def _chromey(self, attrs):
        d = dict(attrs)
        blob = " ".join(filter(None, (d.get("class"), d.get("id"),
                                      d.get("role"), d.get("aria-label"))))
        return bool(blob and CHROME.search(blob))

    # -- parser hooks -----------------------------------------------------

    def handle_starttag(self, tag, attrs):
        if self.drop:
            if tag in DROP or tag in ("div", "section", "ul", "span", "p",
                                      "table", "figure"):
                self.drop += 1
            return
        if tag in DROP:
            self.drop = 1
            return
        if tag in ("div", "section", "span", "ul", "table", "figure", "p") \
                and self._chromey(attrs):
            self.drop = 1
            return

        if tag == "a":
            d = dict(attrs)
            h = (d.get("href") or "").strip()
            if h and not h.startswith(("#", "javascript:", "mailto:tel")):
                self.href = urllib.parse.urljoin(self.base, h)
                self.atext = []
            return
        if tag in ("b", "strong"):
            self._emit("**")
        elif tag in ("i", "em"):
            self._emit("*")
        elif tag == "code":
            self._emit("`")
        elif tag == "sup":
            # superscript citation markers must survive as markers
            self._emit("^")
        elif tag == "br":
            self._flush()
        elif tag == "hr":
            self._flush()
            self.out.append("---")
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._flush()
            self.heading = "#" * min(int(tag[1]) + 1, 6) + " "
        elif tag in ("ul", "ol"):
            self._flush()
            self.lists.append([tag, 0])
        elif tag == "li":
            self._flush()
            if self.lists:
                self.lists[-1][1] += 1
        elif tag in ("p", "div", "section", "blockquote", "tr", "dt", "dd"):
            self._flush()
        elif tag == "pre":
            self._flush()
            self.pre += 1
        elif tag in ("td", "th"):
            self._emit(" | ")

    def handle_endtag(self, tag):
        if self.drop:
            self.drop -= 1
            return
        if tag == "a":
            if self.href is not None:
                txt = re.sub(r"\s+", " ", "".join(self.atext)).strip()
                url = self.href
                self.href = None
                if txt:
                    self.buf.append("[%s](%s)" % (txt, url))
                self.atext = []
            return
        if tag in ("b", "strong"):
            self._emit("**")
        elif tag in ("i", "em"):
            self._emit("*")
        elif tag == "code":
            self._emit("`")
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._flush(self.heading or "## ")
            self.heading = None
        elif tag == "li":
            kind, n = self.lists[-1] if self.lists else ("ul", 0)
            self._flush("%d. " % n if kind == "ol" else "- ")
        elif tag in ("ul", "ol"):
            self._flush()
            if self.lists:
                self.lists.pop()
        elif tag == "blockquote":
            self._flush("> ")
        elif tag == "pre":
            self._flush()
            self.pre = max(0, self.pre - 1)
        elif tag in ("p", "div", "section", "tr", "dt", "dd", "figcaption"):
            self._flush()

    def handle_data(self, data):
        if self.drop:
            return
        if not self.pre:
            data = data.replace("\n", " ")
        if data.strip() or (self.buf and data == " "):
            self._emit(data)

    def close(self):
        super().close()
        self._flush()

    def markdown(self):
        blocks, prev = [], None
        for b in self.out:
            b = b.strip()
            if not b or b == prev:
                continue
            # a bullet immediately after its own text duplicate is noise
            blocks.append(b)
            prev = b
        return "\n\n".join(blocks)


# --------------------------------------------------------------------------
# page handling
# --------------------------------------------------------------------------

def fetch(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml",
                "Accept-Encoding": "gzip",
            })
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                enc = "utf-8"
                ct = r.headers.get("Content-Type", "")
                m = re.search(r"charset=([\w-]+)", ct)
                if m:
                    enc = m.group(1)
                return raw.decode(enc, "replace")
        except Exception as e:                       # noqa: BLE001
            last = e
            time.sleep(2 * (i + 1))
    raise last


def strip_pairs(html):
    """Remove script/style bodies before any positional scanning."""
    return re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", "", html)


def find_body(html):
    """Return the article container's HTML, by class name then by <article>."""
    s = strip_pairs(html)
    for cls in CONTAINERS:
        m = re.search(r'<(div|article|section)\b[^>]*class="[^"]*\b%s\b[^"]*"[^>]*>'
                      % re.escape(cls), s)
        if not m:
            continue
        tag = m.group(1)
        seg = s[m.start():]
        depth = 0
        for t in re.finditer(r"<%s\b|</%s>" % (tag, tag), seg):
            depth += 1 if not t.group().startswith("</") else -1
            if depth == 0:
                return seg[:t.end()]
        return seg
    m = re.search(r"(?is)<article\b.*?</article>", s)
    return m.group(0) if m else None


def meta(html, prop=None, name=None):
    if prop:
        m = re.search(r'<meta[^>]+property="%s"[^>]+content="([^"]*)"' % prop, html)
    else:
        m = re.search(r'<meta[^>]+name="%s"[^>]+content="([^"]*)"' % name, html)
    if not m:
        return ""
    return re.sub(r"\s+", " ", unescape(m.group(1))).strip()


def unescape(s):
    import html as _h
    return _h.unescape(s)


def page_meta(html, url):
    title = meta(html, prop="og:title") or ""
    if not title:
        m = re.search(r"(?is)<title[^>]*>(.*?)</title>", html)
        title = unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip() if m else ""
    # Yoast appends " | Barbell Medicine" - the site name is not the headline
    title = re.sub(r"\s*[|–-]\s*Barbell Medicine\s*$", "", title).strip()

    author = meta(html, name="author")
    if not author:
        m = re.search(r'"author":\{"name":"(.*?)"', html)
        author = unescape(m.group(1)) if m else ""

    date = meta(html, prop="article:published_time")
    if not date:
        m = re.search(r'"datePublished":"(.*?)"', html)
        date = m.group(1) if m else ""
    return {"title": title, "author": author, "date": date[:10], "url": url}


def ref_shape(md):
    """Classify how this article maps claims to sources.

    inline-numbered   [n] markers in the prose, resolvable against a list
    numbered-list     a numbered reference list whose numbers are links
    lumped-list       a reference list with no inline markers at all
    inline-links      links sit in the prose, no list
    none              no scientific links found
    """
    sci = re.compile(r"pubmed|ncbi\.nlm|pmc/articles|doi\.org|\bdoi:|"
                     r"sciencedirect|springer|wiley|tandfonline|bmj\.com|"
                     r"jamanetwork|journals\.lww|physiology\.org|frontiersin|"
                     r"mdpi\.com|biomedcentral|nature\.com|oup\.com|"
                     r"academic\.oup|cochrane|jospt|nih\.gov", re.I)
    links = re.findall(r"\[([^\]]*)\]\((https?://[^)\s]+)\)", md)
    scilinks = [(t, u) for t, u in links if sci.search(u)]

    # The heading is written half a dozen ways across this corpus: as a real
    # heading, as a bold line, with or without a colon, colon inside or outside
    # the asterisks. Be generous - a missed heading turns an inline-numbered
    # article into a "lumped list" in the index, which is the wrong call.
    head = re.search(r"(?im)^[#*_\s]*(references|citations|sources|"
                     r"works cited|bibliography|further reading)"
                     r"[\s*_:]*$", md)
    body_md = md[:head.start()] if head else md
    tail_md = md[head.start():] if head else ""

    markers = re.findall(r"(?<!\()\[(\d{1,3})\]", body_md)
    markers += re.findall(r"\^\s*(\d{1,3})", body_md)
    numlinks = [t for t, u in scilinks if re.fullmatch(r"\[?\(?\d{1,3}\)?\]?", t)]

    if markers and (tail_md or scilinks):
        shape = "inline-numbered"
    elif numlinks:
        shape = "numbered-list"
    elif tail_md and scilinks:
        shape = "lumped-list"
    elif tail_md:
        shape = "lumped-list-unlinked"
    elif scilinks:
        shape = "inline-links"
    else:
        shape = "none"
    return {"ref_shape": shape,
            "n_links": len(links),
            "n_sci_links": len(scilinks),
            "n_inline_markers": len(set(markers)),
            "n_numbered_links": len(numlinks),
            "has_ref_section": bool(head)}


def slug_for(url):
    p = urllib.parse.urlparse(url).path.rstrip("/")
    s = p.rsplit("/", 1)[-1] or "index"
    s = re.sub(r"[^A-Za-z0-9._-]+", "-", s).strip("-")
    return s[:110] or "index"


def extract(url, html):
    body = find_body(html)
    if body is None:
        return None, None, "no-article-container"
    p = ToMarkdown(base_url=url)
    p.feed(body)
    p.close()
    md = p.markdown()
    if len(md.split()) < 60:
        return None, None, "too-short(%d words)" % len(md.split())
    info = page_meta(html, url)
    info.update(ref_shape(md))
    info["words"] = len(re.sub(r"\[[^\]]*\]\([^)]*\)", " x ", md).split())
    header = ("# %s\n\n- Source: Barbell Medicine\n- Author: %s\n"
              "- Published: %s\n- URL: %s\n- Words: %d\n\n---\n\n"
              % (info["title"] or slug_for(url), info["author"] or "unknown",
                 info["date"] or "unknown", url, info["words"]))
    return header + md + "\n", info, "ok"


# --------------------------------------------------------------------------
# catalogue
# --------------------------------------------------------------------------

def catalogue(src, outdir, match):
    """Enumerate once and cache. Cheap to redo, annoying to lose."""
    man = outdir / "manifest.json"
    if man.exists():
        urls = json.loads(man.read_text("utf-8"))
    else:
        text = fetch(src)
        if "<loc>" in text:
            urls = [unescape(u) for u in re.findall(r"<loc>\s*(.*?)\s*</loc>", text)]
            # a sitemap index points at more sitemaps
            if all(u.endswith(".xml") for u in urls) and urls:
                out = []
                for sm in urls:
                    time.sleep(1)
                    out += [unescape(u) for u in
                            re.findall(r"<loc>\s*(.*?)\s*</loc>", fetch(sm))]
                urls = out
        else:
            host = urllib.parse.urlparse(src).netloc
            urls = []
            for h in re.findall(r'href="([^"#]+)"', text):
                a = urllib.parse.urljoin(src, h)
                if urllib.parse.urlparse(a).netloc == host:
                    urls.append(a)
        seen, uniq = set(), []
        for u in urls:
            if u not in seen:
                seen.add(u)
                uniq.append(u)
        urls = uniq
        man.write_text(json.dumps(urls, indent=1), encoding="utf-8")
    if match:
        rx = re.compile(match)
        urls = [u for u in urls if rx.search(u)]
    return urls


def build_index(outdir, dest):
    """Rebuild the index from what is on disk. Safe to run mid-fetch."""
    recs = json.loads((outdir / "meta.json").read_text("utf-8")) \
        if (outdir / "meta.json").exists() else {}
    rows = sorted(recs.values(), key=lambda r: (r.get("date") or "", r["url"]))
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(rows, indent=1, ensure_ascii=False), encoding="utf-8")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", help="sitemap URL, index-page URL, or - with --index-only")
    ap.add_argument("outdir")
    ap.add_argument("--delay", type=float, default=2.0)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--match", default="", help="only URLs matching this regex")
    ap.add_argument("--index-out", default="", help="also write an index json here")
    ap.add_argument("--index-only", action="store_true",
                    help="rebuild the index from disk and exit")
    a = ap.parse_args()

    outdir = Path(a.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    if a.index_only:
        rows = build_index(outdir, a.index_out or (outdir / "index.json"))
        sys.stderr.write("index: %d articles\n" % len(rows))
        return

    urls = catalogue(a.src, outdir, a.match)
    if a.limit:
        urls = urls[:a.limit]
    sys.stderr.write("catalogue: %d urls\n" % len(urls))

    fpath = outdir / "failures.json"
    fails = json.loads(fpath.read_text("utf-8")) if fpath.exists() else {}
    mpath = outdir / "meta.json"
    metas = json.loads(mpath.read_text("utf-8")) if mpath.exists() else {}

    done = skipped = 0
    for i, url in enumerate(urls):
        dest = outdir / (slug_for(url) + ".md")
        if dest.exists() and url in metas:
            skipped += 1
            continue
        time.sleep(a.delay)
        try:
            html = fetch(url)
            md, info, status = extract(url, html)
        except Exception as e:                        # noqa: BLE001 - keep going
            md, info, status = None, None, "error: %s" % e
        if status == "ok":
            dest.write_text(md, encoding="utf-8")
            info["slug"] = dest.stem
            metas[url] = info
            fails.pop(url, None)
            done += 1
        else:
            fails[url] = {"status": status}
        if (i + 1) % 10 == 0:
            mpath.write_text(json.dumps(metas, indent=1, ensure_ascii=False),
                             encoding="utf-8")
            fpath.write_text(json.dumps(fails, indent=1), encoding="utf-8")
            sys.stderr.write("  %d/%d  ok=%d skip=%d fail=%d\n"
                             % (i + 1, len(urls), done, skipped, len(fails)))
            sys.stderr.flush()

    mpath.write_text(json.dumps(metas, indent=1, ensure_ascii=False), encoding="utf-8")
    fpath.write_text(json.dumps(fails, indent=1), encoding="utf-8")
    if a.index_out:
        build_index(outdir, a.index_out)
    sys.stderr.write("DONE ok=%d skipped=%d failed=%d\n" % (done, skipped, len(fails)))


if __name__ == "__main__":
    main()
