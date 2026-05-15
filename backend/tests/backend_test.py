"""Backend API test suite for Astra OS - hello world, status, and proxy endpoints."""
import os
import urllib.parse
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://eye-everything.preview.emergentagent.com").rstrip("/")
TIMEOUT = 30


# ---------- Module: existing endpoints regression ----------
class TestExistingEndpoints:
    def test_hello_world(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data.get("message") == "Hello World"

    def test_create_status(self):
        payload = {"client_name": "TEST_pytest_astra"}
        r = requests.post(f"{BASE_URL}/api/status", json=payload, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data["client_name"] == "TEST_pytest_astra"
        assert "id" in data and isinstance(data["id"], str)
        assert "timestamp" in data

    def test_get_status_list(self):
        r = requests.get(f"{BASE_URL}/api/status", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)


# ---------- Module: proxy health ----------
class TestProxyHealth:
    def test_proxy_health(self):
        r = requests.get(f"{BASE_URL}/api/proxy/health", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("service") == "astra-proxy"


# ---------- Module: proxy GET fetch ----------
class TestProxyFetch:
    def test_proxy_example_com(self):
        url = f"{BASE_URL}/api/proxy?url=" + urllib.parse.quote("https://example.com", safe="")
        r = requests.get(url, timeout=TIMEOUT)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        assert "Example Domain" in r.text

    def test_proxy_strips_security_headers(self):
        url = f"{BASE_URL}/api/proxy?url=" + urllib.parse.quote("https://example.com", safe="")
        r = requests.get(url, timeout=TIMEOUT)
        assert r.status_code == 200
        lower_headers = {k.lower() for k in r.headers.keys()}
        # X-Frame-Options and CSP must be stripped
        assert "x-frame-options" not in lower_headers
        assert "content-security-policy" not in lower_headers

    def test_proxy_injects_base_tag(self):
        url = f"{BASE_URL}/api/proxy?url=" + urllib.parse.quote("https://example.com", safe="")
        r = requests.get(url, timeout=TIMEOUT)
        assert r.status_code == 200
        # base href must be present
        assert "<base href=" in r.text.lower() or "<base href=" in r.text

    def test_proxy_rewrites_links(self):
        # example.com has an anchor tag with href; verify it gets routed through proxy
        url = f"{BASE_URL}/api/proxy?url=" + urllib.parse.quote("https://example.com", safe="")
        r = requests.get(url, timeout=TIMEOUT)
        assert r.status_code == 200
        assert "/api/proxy?url=" in r.text

    def test_proxy_handles_bare_domain(self):
        # No protocol prefix
        url = f"{BASE_URL}/api/proxy?url=example.com"
        r = requests.get(url, timeout=TIMEOUT)
        assert r.status_code == 200
        assert "Example Domain" in r.text

    def test_proxy_handles_network_error(self):
        # Use a non-existent domain
        url = f"{BASE_URL}/api/proxy?url=" + urllib.parse.quote(
            "https://this-domain-definitely-does-not-exist-asdfqwerty.invalid", safe=""
        )
        r = requests.get(url, timeout=TIMEOUT)
        # Backend returns 502 with HTML error page
        assert r.status_code == 502
        assert "Proxy error" in r.text


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
