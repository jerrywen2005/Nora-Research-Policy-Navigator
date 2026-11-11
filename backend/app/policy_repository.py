"""The UNC Research Policy Repository (policies.unc.edu), the source of every document's text.

- Article links: parse either link form and build the official one the Link wants cited.
- `RepositoryClient`: fetches an article. It's an interface so tests use a fake and never touch
  the network; `HttpRepositoryClient` is the real one.
- `extract_article`: title and text from an article page, keeping headings as Markdown so RAG
  ingestion can split on sections (docs/rag.md).
"""

import re
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Protocol
from urllib.parse import urlsplit

REPOSITORY_HOST = "policies.unc.edu"
ARTICLE_URL = "https://policies.unc.edu/TDClient/2833/Portal/KB/Article/{article_id}"

# /KB/Article/132183, /KB/Article/132183/Some-Title, or /KB/ArticleDet?ID=132183
_ARTICLE_PATH = re.compile(r"^/TDClient/2833/Portal/KB/(?:Article/(\d+)(?:/[^/?#]*)?|ArticleDet)$")
_ARTICLE_ID_PARAM = re.compile(r"(?:^|&)ID=(\d+)(?:&|$)")


def parse_article_id(url: str) -> int | None:
    """The Repository article id in a policies.unc.edu article link, or None if it isn't one."""
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https") or parts.hostname != REPOSITORY_HOST:
        return None
    match = _ARTICLE_PATH.match(parts.path)
    if match is None:
        return None
    if match.group(1):
        return int(match.group(1))
    param = _ARTICLE_ID_PARAM.search(parts.query)
    return int(param.group(1)) if param else None


def official_url(article_id: int) -> str:
    return ARTICLE_URL.format(article_id=article_id)


class RepositoryError(Exception):
    """The article couldn't be fetched or had no article text."""


class RepositoryClient(Protocol):
    def fetch_article(self, article_id: int) -> str:
        """The article page's HTML. Raises RepositoryError on failure."""
        ...


class HttpRepositoryClient:
    def __init__(self, timeout_seconds: float = 15) -> None:
        self.timeout_seconds = timeout_seconds

    def fetch_article(self, article_id: int) -> str:
        request = urllib.request.Request(
            official_url(article_id), headers={"User-Agent": "Nora-Research-Policy-Navigator"}
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                return response.read().decode("utf-8", errors="replace")
        except OSError as error:  # URLError, HTTPError and timeouts are all OSErrors
            raise RepositoryError(f"Couldn't fetch article {article_id}: {error}") from error


def get_repository_client() -> RepositoryClient:
    """FastAPI dependency; tests override it with a fake."""
    return HttpRepositoryClient()


@dataclass
class Article:
    title: str
    content_text: str


_BODY_ID = "ctl00_ctl00_cpContent_cpContent_divBody"
_HEADINGS = {"h2": "## ", "h3": "### ", "h4": "#### ", "h5": "##### "}
_BLOCKS = {"p", "li", "div", "tr", "br", "table", "ul", "ol"} | set(_HEADINGS)


class _ArticleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.in_title = False
        self.body_depth = 0  # >0 while inside the article body's <div>
        self.lines: list[str] = []
        self.current: list[str] = []
        self.prefix = ""

    def _flush(self) -> None:
        text = " ".join("".join(self.current).split())
        if text:
            self.lines.append(self.prefix + text)
        self.current, self.prefix = [], ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "h1" and "gutter-top" in (attributes.get("class") or ""):
            self.in_title = True
        if self.body_depth:
            if tag == "div":
                self.body_depth += 1
            if tag in _BLOCKS:
                self._flush()
            if tag in ("td", "th"):
                self.current.append(" ")  # keep table cells apart
            if tag in _HEADINGS:
                self.prefix = _HEADINGS[tag]
            elif tag == "li":
                self.prefix = "- "
        elif tag == "div" and attributes.get("id") == _BODY_ID:
            self.body_depth = 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "h1":
            self.in_title = False
        if self.body_depth:
            if tag in _BLOCKS:
                self._flush()
            if tag == "div":
                self.body_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)
        elif self.body_depth:
            self.current.append(data)


def extract_article(html: str) -> Article:
    """Title and text of a Repository article page. Raises RepositoryError if either is missing."""
    parser = _ArticleParser()
    parser.feed(html)
    parser.close()
    title = " ".join("".join(parser.title_parts).split())
    content_text = "\n\n".join(parser.lines)
    if not title or not content_text:
        raise RepositoryError("The page has no article title or text")
    return Article(title=title, content_text=content_text)
