"""Iteration 3 tests: session cookies, per-user proxy cookie jar, clear-cookies,
   blocked-page friendly response has zero external links."""
import os
import base64
import json
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _new_user_payload():
    return {"username": f"t_{uuid.uuid4().hex[:8]}", "password": "pw_test_1234"}


# ----- 1) AUTH session cookie -----
class TestAuthSessionCookie:
    def test_register_sets_session_cookie(self):
        s = requests.Session()
        body = _new_user_payload()
        r = s.post(f"{BASE_URL}/api/auth/register", json=body, timeout=20)
        assert r.status_code == 200, r.text
        # Cookie must be present
        assert "astra_sess" in s.cookies, f"astra_sess missing. cookies={dict(s.cookies)}"
        token = s.cookies.get("astra_sess")
        # Decode JWT payload (middle segment)
        parts = token.split(".")
        assert len(parts) == 3
        payload = json.loads(_b64url_decode(parts[1]))
        assert payload.get("sub") == r.json()["user"]["id"]
        # Set-Cookie attributes
        sc = r.headers.get("set-cookie", "")
        assert "HttpOnly" in sc and "Secure" in sc
        assert "SameSite=lax" in sc.lower() or "samesite=lax" in sc.lower()

    def test_login_sets_session_cookie(self):
        body = _new_user_payload()
        # Register first
        r1 = requests.post(f"{BASE_URL}/api/auth/register", json=body, timeout=20)
        assert r1.status_code == 200
        # Now login with fresh session
        s = requests.Session()
        r2 = s.post(f"{BASE_URL}/api/auth/login", json=body, timeout=20)
        assert r2.status_code == 200
        assert "astra_sess" in s.cookies


# ----- 2) Per-user cookie jar -----
class TestPerUserCookieJar:
    def test_cookie_jar_captures_and_replays_upstream(self):
        s = requests.Session()
        body = _new_user_payload()
        r = s.post(f"{BASE_URL}/api/auth/register", json=body, timeout=20)
        assert r.status_code == 200
        # Set cookies on httpbin via proxy
        marker = f"astra_{uuid.uuid4().hex[:6]}"
        set_url = f"https://httpbin.org/cookies/set?foo={marker}&baz=qux"
        r1 = s.get(f"{BASE_URL}/api/proxy", params={"url": set_url}, timeout=30)
        assert r1.status_code == 200
        # Now read cookies httpbin sees
        r2 = s.get(f"{BASE_URL}/api/proxy", params={"url": "https://httpbin.org/cookies"}, timeout=30)
        assert r2.status_code == 200
        text = r2.text
        # Proxy rewrites HTML; raw body should still contain the cookie key/values
        assert marker in text, f"expected marker {marker} in proxied /cookies response"
        assert "baz" in text and "qux" in text

    def test_cookies_are_user_scoped(self):
        # User A
        sA = requests.Session()
        bodyA = _new_user_payload()
        assert sA.post(f"{BASE_URL}/api/auth/register", json=bodyA, timeout=20).status_code == 200
        marker = f"userA_{uuid.uuid4().hex[:6]}"
        sA.get(f"{BASE_URL}/api/proxy",
               params={"url": f"https://httpbin.org/cookies/set?sess={marker}"},
               timeout=30)
        # User B (separate session jar)
        sB = requests.Session()
        bodyB = _new_user_payload()
        assert sB.post(f"{BASE_URL}/api/auth/register", json=bodyB, timeout=20).status_code == 200
        r = sB.get(f"{BASE_URL}/api/proxy",
                   params={"url": "https://httpbin.org/cookies"}, timeout=30)
        assert r.status_code == 200
        assert marker not in r.text, "User B should NOT see User A's cookies"

    def test_anonymous_no_cookie_jar(self):
        s = requests.Session()  # no astra_sess
        r = s.get(f"{BASE_URL}/api/proxy",
                  params={"url": "https://httpbin.org/cookies"}, timeout=30)
        assert r.status_code == 200
        # No prior user — body should not show astra_ markers from anyone
        # (We at least verify it returned successfully without crash.)


# ----- 3) Clear-cookies endpoint -----
class TestClearCookies:
    def test_clear_cookies_removes_jar(self):
        s = requests.Session()
        body = _new_user_payload()
        r = s.post(f"{BASE_URL}/api/auth/register", json=body, timeout=20)
        assert r.status_code == 200
        token = r.json()["token"]
        # Seed several cookies
        marker = f"clr_{uuid.uuid4().hex[:6]}"
        s.get(f"{BASE_URL}/api/proxy",
              params={"url": f"https://httpbin.org/cookies/set?a={marker}&b=2&c=3"},
              timeout=30)
        # Clear
        rc = requests.post(
            f"{BASE_URL}/api/proxy/clear-cookies",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert rc.status_code == 200, rc.text
        data = rc.json()
        assert data.get("ok") is True
        assert data.get("deleted", 0) >= 1
        # After clear, cookies should be gone
        r2 = s.get(f"{BASE_URL}/api/proxy",
                   params={"url": "https://httpbin.org/cookies"}, timeout=30)
        assert r2.status_code == 200
        assert marker not in r2.text

    def test_clear_cookies_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/proxy/clear-cookies", timeout=10)
        assert r.status_code == 401


# ----- 4) Blocked-page friendly response has zero external links -----
class TestBlockedPageNoExternalLinks:
    def test_blocked_page_no_external_anchor(self):
        # Wikipedia non-browser UA returns 403; our proxy renders friendly page
        s = requests.Session()
        body = _new_user_payload()
        assert s.post(f"{BASE_URL}/api/auth/register", json=body, timeout=20).status_code == 200
        r = s.get(f"{BASE_URL}/api/proxy",
                  params={"url": "https://en.wikipedia.org/wiki/Main_Page"}, timeout=30)
        assert r.status_code == 200
        html = r.text
        # If wikipedia served us actual HTML this iteration, no friendly page → skip
        if "blocked the proxy" not in html:
            pytest.skip("Wikipedia did not return a blocked-style response this time")
        assert 'target="_blank"' not in html
        assert 'target=\\"_blank\\"' not in html
        assert "rel=\"noopener\"" not in html
        assert "rel='noopener'" not in html
        # No anchor that opens upstream URL
        assert "<a class='btn'" not in html and '<a class="btn"' not in html
        # Must have internal button
        assert "<button class='btn'" in html or '<button class="btn"' in html
        assert "Try again" in html
        # Button onclick should route through proxy
        assert "/api/proxy?url=" in html
