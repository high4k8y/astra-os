"""Backend tests for /api/proxy content rewriting + bot-block landing page."""
import os
import re
from urllib.parse import quote

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PROXY_PREFIX = "/api/proxy?url="


def _proxy_get(target: str, timeout: int = 40) -> requests.Response:
    return requests.get(
        f"{BASE_URL}/api/proxy",
        params={"url": target},
        timeout=timeout,
    )


# ----------------- (1) Content rewriting + JS shim injection -----------------
class TestProxyRewriting:
    def test_proxy_health(self):
        r = requests.get(f"{BASE_URL}/api/proxy/health", timeout=10)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_example_dot_com_base_and_shim(self):
        r = _proxy_get("https://example.com")
        assert r.status_code == 200, r.text[:200]
        body = r.text
        # base tag injected
        assert '<base href="https://example.com/">' in body
        # JS shim marker
        assert "astra-proxy" in body
        assert "XMLHttpRequest.prototype.open" in body
        assert "window.fetch" in body

    def test_duckduckgo_shim_and_wrapping(self):
        r = _proxy_get("https://duckduckgo.com")
        assert r.status_code == 200, r.text[:200]
        body = r.text
        assert "astra-proxy" in body
        assert "XMLHttpRequest.prototype.open" in body
        assert "window.fetch" in body

    def test_hn_links_wrapped(self):
        r = _proxy_get("https://news.ycombinator.com")
        assert r.status_code == 200, r.text[:200]
        body = r.text
        assert "astra-proxy" in body
        wrapped_count = len(re.findall(re.escape(PROXY_PREFIX), body))
        # there are tons of links on the HN front page; demand at least 3 wrapped
        assert wrapped_count >= 3, f"only {wrapped_count} wrapped URLs found"

    def test_mdn_shim_and_base(self):
        r = _proxy_get("https://developer.mozilla.org/en-US/")
        assert r.status_code == 200, r.text[:200]
        body = r.text
        assert "astra-proxy" in body
        assert "<base href=" in body
        assert PROXY_PREFIX in body

    def test_github_shim_and_links(self):
        r = _proxy_get("https://github.com")
        assert r.status_code == 200, r.text[:200]
        body = r.text
        assert "astra-proxy" in body
        assert PROXY_PREFIX in body


# ----------------- (2) Bot-block fallback landing page -----------------
class TestProxyBotBlockFallback:
    def test_wikipedia_bot_block_friendly_page(self):
        target = "https://en.wikipedia.org/wiki/Main_Page"
        r = _proxy_get(target)
        # MUST be 200 — friendly page, not 403
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        body = r.text
        # Friendly page markers
        # (Wikipedia may or may not actually block — we only assert friendly page IF it did)
        # We assert the proxy didn't propagate 4xx upward.
        assert "<html" in body.lower() or "<!doctype html" in body.lower()
        # If it triggered the bot-block branch, these strings appear:
        if "blocked the proxy" in body:
            assert "Open in real browser" in body
            assert target in body  # the link href


# ----------------- (3) CSS rewriting -----------------
class TestProxyCssRewriting:
    def test_css_url_rewrite_from_example(self):
        """Pick a known CSS file (Google fonts) and verify url() / @import got rewritten."""
        # Google Fonts CSS is a deterministic CSS-only response containing @import / url()
        css_target = "https://fonts.googleapis.com/css2?family=Inter&display=swap"
        r = _proxy_get(css_target)
        assert r.status_code == 200, r.text[:200]
        ct = r.headers.get("content-type", "").lower()
        assert "text/css" in ct, f"content-type: {ct}"
        body = r.text
        # at least one url(...) reference should be rewritten through proxy prefix
        # Google Fonts CSS contains url(https://fonts.gstatic.com/...)
        assert PROXY_PREFIX in body, "no rewritten urls in CSS body"
        # the rewritten url() syntax should look like url("/api/proxy?url=...")
        assert re.search(r'url\("/api/proxy\?url=', body) is not None
