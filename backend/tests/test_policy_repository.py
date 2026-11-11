import io
import urllib.error

import pytest

from app import policy_repository
from app.policy_repository import (
    HttpRepositoryClient,
    RepositoryError,
    extract_article,
    get_repository_client,
    official_url,
    parse_article_id,
)

# The shape of a real policies.unc.edu article page, trimmed.
ARTICLE_HTML = """
<html><body>
<h1>Site header</h1>
<h1 class="gutter-top" style="word-wrap: break-word;">
  Care and Use of
  Vertebrate Animals Policy
</h1>
<div id="ctl00_ctl00_cpContent_cpContent_divTags"><a>University-Policy</a></div>
<div id="ctl00_ctl00_cpContent_cpContent_divBody" class="gutter-top"><h2>Introduction</h2>
<h3>Purpose</h3>
<p>This policy   provides <strong>resources</strong> &amp; guidance.</p>
<div><ul><li>First item</li><li>Second<br>line</li></ul></div>
<h4>Contacts</h4><p></p>
<table><tr><td>Phone</td><td>919-000-0000</td></tr></table>
</div>
<div class="feedback">0 reviews</div>
</body></html>
"""


@pytest.mark.parametrize(
    "url",
    [
        "https://policies.unc.edu/TDClient/2833/Portal/KB/Article/132183",
        "https://policies.unc.edu/TDClient/2833/Portal/KB/Article/132183/Some-Title-Policy",
        "  http://policies.unc.edu/TDClient/2833/Portal/KB/ArticleDet?ID=132183  ",
        "https://policies.unc.edu/TDClient/2833/Portal/KB/ArticleDet?x=1&ID=132183&y=2",
    ],
)
def test_parse_article_id_accepts_both_link_forms(url: str):
    assert parse_article_id(url) == 132183


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/TDClient/2833/Portal/KB/Article/132183",
        "ftp://policies.unc.edu/TDClient/2833/Portal/KB/Article/132183",
        "https://policies.unc.edu/TDClient/2833/Portal/KB/Search?ID=132183",
        "https://policies.unc.edu/TDClient/2833/Portal/KB/ArticleDet?ID=abc",
        "https://policies.unc.edu/TDClient/2833/Portal/KB/ArticleDet",
        "not a url",
    ],
)
def test_parse_article_id_rejects_other_links(url: str):
    assert parse_article_id(url) is None


def test_official_url():
    assert official_url(7) == "https://policies.unc.edu/TDClient/2833/Portal/KB/Article/7"


def test_extract_article_keeps_headings_and_lists():
    article = extract_article(ARTICLE_HTML)

    assert article.title == "Care and Use of Vertebrate Animals Policy"
    assert article.content_text == (
        "## Introduction\n\n"
        "### Purpose\n\n"
        "This policy provides resources & guidance.\n\n"
        "- First item\n\n"
        "- Second\n\n"
        "line\n\n"
        "#### Contacts\n\n"
        "Phone 919-000-0000"
    )


def test_extract_article_without_body_fails():
    with pytest.raises(RepositoryError):
        extract_article('<h1 class="gutter-top">Title only</h1>')


class _FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def test_http_client_fetches_the_official_url(monkeypatch):
    seen = {}

    def fake_urlopen(request, timeout):
        seen["url"], seen["timeout"] = request.full_url, timeout
        return _FakeResponse("<p>café</p>".encode())

    monkeypatch.setattr(policy_repository.urllib.request, "urlopen", fake_urlopen)

    html = HttpRepositoryClient(timeout_seconds=3).fetch_article(42)

    assert html == "<p>café</p>"
    assert seen == {"url": official_url(42), "timeout": 3}


def test_http_client_wraps_network_errors(monkeypatch):
    def fail(request, timeout):
        raise urllib.error.URLError("down")

    monkeypatch.setattr(policy_repository.urllib.request, "urlopen", fail)

    with pytest.raises(RepositoryError, match="article 42"):
        HttpRepositoryClient().fetch_article(42)


def test_get_repository_client_is_the_http_client():
    assert isinstance(get_repository_client(), HttpRepositoryClient)
