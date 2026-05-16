"""
Astra OS — feature tests for HW ban, chat delete, remote control endpoints.
Covers: auth+fingerprint, hardware ban end-to-end, chat delete (admin + own),
admin control endpoints (notify/launch/navigate/closeall/takeover/logout/kick/broadcast),
and WebSocket message delivery for those control events.
"""
import os
import json
import uuid
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")
TIMEOUT = 30
DEV_CODE = "201167"


def _unique(prefix):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}"


def _register(username, password="pw1234", dev=False, fingerprint=None):
    body = {"username": username, "password": password}
    if dev:
        body["dev_code"] = DEV_CODE
    if fingerprint:
        body["fingerprint"] = fingerprint
    return requests.post(f"{BASE_URL}/api/auth/register", json=body, timeout=TIMEOUT)


def _login(username, password="pw1234", fingerprint=None):
    body = {"username": username, "password": password}
    if fingerprint:
        body["fingerprint"] = fingerprint
    return requests.post(f"{BASE_URL}/api/auth/login", json=body, timeout=TIMEOUT)


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- AUTH + FINGERPRINT ----------
class TestAuthFingerprint:
    def test_register_login_with_fingerprint(self):
        uname = _unique("fpu")
        fp = f"fp-{uuid.uuid4().hex[:6]}"
        r = _register(uname, fingerprint=fp)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["user"]["username"] == uname

        r2 = _login(uname, fingerprint=fp)
        assert r2.status_code == 200, r2.text
        assert "token" in r2.json()

    def test_register_without_fingerprint_works(self):
        r = _register(_unique("nofp"))
        assert r.status_code == 200


# ---------- HARDWARE BAN END-TO-END ----------
class TestHardwareBan:
    def test_hwban_flow(self):
        dev_name = _unique("dev")
        victim_name = _unique("vic")
        fp_dev = f"fp-A-{uuid.uuid4().hex[:6]}"
        fp_vic = f"fp-V-{uuid.uuid4().hex[:6]}"

        rd = _register(dev_name, dev=True, fingerprint=fp_dev)
        assert rd.status_code == 200, rd.text
        dev_token = rd.json()["token"]

        rv = _register(victim_name, fingerprint=fp_vic)
        assert rv.status_code == 200, rv.text
        victim_id = rv.json()["user"]["id"]

        # HW ban
        rb = requests.post(
            f"{BASE_URL}/api/admin/users/{victim_id}/hwban",
            headers=_auth_headers(dev_token),
            json={"reason": "test"},
            timeout=TIMEOUT,
        )
        assert rb.status_code == 200, rb.text
        body = rb.json()
        assert body["ok"] is True
        assert body["fingerprints_banned"] >= 1

        # Login victim → 403
        rlv = _login(victim_name, fingerprint=fp_vic)
        assert rlv.status_code == 403, rlv.text

        # Register new user with same fp → 403
        rn = _register(_unique("newvic"), fingerprint=fp_vic)
        assert rn.status_code == 403, rn.text

        # Unban
        ru = requests.post(
            f"{BASE_URL}/api/admin/users/{victim_id}/hwunban",
            headers=_auth_headers(dev_token), timeout=TIMEOUT,
        )
        assert ru.status_code == 200, ru.text
        assert ru.json()["ok"] is True

        # Register new user with same fp again → 200
        rn2 = _register(_unique("postunban"), fingerprint=fp_vic)
        assert rn2.status_code == 200, rn2.text

        # Save context for WS tests
        TestHardwareBan.dev_token = dev_token
        TestHardwareBan.victim_name = victim_name
        TestHardwareBan.victim_id = victim_id
        TestHardwareBan.fp_vic = fp_vic


# ---------- WS + REMOTE CONTROL ----------
@pytest.mark.asyncio
async def test_remote_control_via_ws():
    # Setup users
    dev_name = _unique("dev2")
    vic_name = _unique("vic2")
    fp_d = f"fp-{uuid.uuid4().hex[:6]}"
    fp_v = f"fp-{uuid.uuid4().hex[:6]}"

    rd = _register(dev_name, dev=True, fingerprint=fp_d)
    assert rd.status_code == 200
    dev_token = rd.json()["token"]

    rv = _register(vic_name, fingerprint=fp_v)
    assert rv.status_code == 200
    victim_id = rv.json()["user"]["id"]
    victim_token = rv.json()["token"]

    dev_ws_url = f"{WS_BASE}/api/ws/chat?token={dev_token}&fp={fp_d}"
    vic_ws_url = f"{WS_BASE}/api/ws/chat?token={victim_token}&fp={fp_v}"

    async with websockets.connect(dev_ws_url) as dev_ws, websockets.connect(vic_ws_url) as vic_ws:
        # Drain initial 'online' frames on both
        async def drain(ws, timeout=1.5):
            try:
                while True:
                    await asyncio.wait_for(ws.recv(), timeout=timeout)
            except asyncio.TimeoutError:
                pass

        await drain(dev_ws)
        await drain(vic_ws)

        async def expect_type(ws, want_type, timeout=5.0, extra_check=None):
            end = asyncio.get_event_loop().time() + timeout
            while asyncio.get_event_loop().time() < end:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=end - asyncio.get_event_loop().time())
                except asyncio.TimeoutError:
                    break
                msg = json.loads(raw)
                if msg.get("type") == want_type and (extra_check is None or extra_check(msg)):
                    return msg
            raise AssertionError(f"Did not receive '{want_type}' frame")

        H = _auth_headers(dev_token)
        # notify
        r = requests.post(f"{BASE_URL}/api/admin/users/{victim_id}/notify", headers=H,
                          json={"title": "Hi", "body": "There"}, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["ok"] and r.json()["sent"] >= 1
        m = await expect_type(vic_ws, "notify")
        assert m["title"] == "Hi"

        # launch
        r = requests.post(f"{BASE_URL}/api/admin/users/{victim_id}/launch", headers=H,
                          json={"app": "Notes"}, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["sent"] >= 1
        m = await expect_type(vic_ws, "launch")
        assert m["app"] == "Notes"

        # navigate
        r = requests.post(f"{BASE_URL}/api/admin/users/{victim_id}/navigate", headers=H,
                          json={"url": "https://example.com"}, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["sent"] >= 1
        m = await expect_type(vic_ws, "navigate")
        assert m["url"] == "https://example.com"

        # closeall
        r = requests.post(f"{BASE_URL}/api/admin/users/{victim_id}/closeall", headers=H,
                          json={}, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["sent"] >= 1
        await expect_type(vic_ws, "closeall")

        # takeover
        r = requests.post(f"{BASE_URL}/api/admin/users/{victim_id}/takeover", headers=H,
                          json={"title": "T", "body": "B", "duration_ms": 3000}, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["sent"] >= 1
        m = await expect_type(vic_ws, "takeover")
        assert m["duration_ms"] == 3000

        # broadcast (both should receive)
        r = requests.post(f"{BASE_URL}/api/admin/broadcast", headers=H,
                          json={"title": "BC", "body": "Hello all"}, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["ok"]
        bv = await expect_type(vic_ws, "notify", extra_check=lambda m: m.get("broadcast") is True)
        assert bv["title"] == "BC"
        bd = await expect_type(dev_ws, "notify", extra_check=lambda m: m.get("broadcast") is True)
        assert bd["title"] == "BC"

        # force_logout
        r = requests.post(f"{BASE_URL}/api/admin/users/{victim_id}/logout", headers=H,
                          json={}, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["sent"] >= 1
        await expect_type(vic_ws, "force_logout")

        # kick — victim WS should close with 4001
        r = requests.post(f"{BASE_URL}/api/admin/users/{victim_id}/kick", headers=H, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["ok"]
        # Read until close
        closed_code = None
        try:
            for _ in range(10):
                await asyncio.wait_for(vic_ws.recv(), timeout=3.0)
        except websockets.ConnectionClosed as e:
            closed_code = e.code
        except asyncio.TimeoutError:
            pass
        assert closed_code == 4001, f"Expected close 4001, got {closed_code}"


# ---------- CHAT DELETE ----------
@pytest.mark.asyncio
async def test_chat_delete_flows():
    dev_name = _unique("dev3")
    vic_name = _unique("vic3")
    fp_d = f"fp-{uuid.uuid4().hex[:6]}"
    fp_v = f"fp-{uuid.uuid4().hex[:6]}"

    dev_token = _register(dev_name, dev=True, fingerprint=fp_d).json()["token"]
    vic_resp = _register(vic_name, fingerprint=fp_v).json()
    vic_token = vic_resp["token"]

    dev_ws_url = f"{WS_BASE}/api/ws/chat?token={dev_token}&fp={fp_d}"
    vic_ws_url = f"{WS_BASE}/api/ws/chat?token={vic_token}&fp={fp_v}"

    async with websockets.connect(dev_ws_url) as dev_ws, websockets.connect(vic_ws_url) as vic_ws:
        async def collect_msg(ws, want_text, timeout=5.0):
            end = asyncio.get_event_loop().time() + timeout
            while asyncio.get_event_loop().time() < end:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=end - asyncio.get_event_loop().time())
                except asyncio.TimeoutError:
                    break
                m = json.loads(raw)
                if m.get("type") == "message" and m.get("data", {}).get("text") == want_text:
                    return m["data"]
            raise AssertionError(f"No message frame with text={want_text}")

        async def expect_delete(ws, want_id, timeout=5.0):
            end = asyncio.get_event_loop().time() + timeout
            while asyncio.get_event_loop().time() < end:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=end - asyncio.get_event_loop().time())
                except asyncio.TimeoutError:
                    break
                m = json.loads(raw)
                if m.get("type") == "delete" and m.get("id") == want_id:
                    return m
            raise AssertionError(f"No delete frame for {want_id}")

        # Victim sends a message
        text1 = f"hello-{uuid.uuid4().hex[:6]}"
        await vic_ws.send(json.dumps({"text": text1}))
        msg1 = await collect_msg(dev_ws, text1)
        msg1_id = msg1["id"]

        # Admin: GET /admin/chat/recent contains it
        r = requests.get(f"{BASE_URL}/api/admin/chat/recent",
                         headers=_auth_headers(dev_token), timeout=TIMEOUT)
        assert r.status_code == 200
        ids = [m["id"] for m in r.json()["messages"]]
        assert msg1_id in ids

        # Admin deletes
        r = requests.delete(f"{BASE_URL}/api/admin/chat/{msg1_id}",
                            headers=_auth_headers(dev_token), timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["ok"] is True
        await expect_delete(dev_ws, msg1_id)

        # Victim sends another message
        text2 = f"mine-{uuid.uuid4().hex[:6]}"
        await vic_ws.send(json.dumps({"text": text2}))
        msg2 = await collect_msg(dev_ws, text2)
        msg2_id = msg2["id"]

        # Victim deletes own
        r = requests.delete(f"{BASE_URL}/api/chat/messages/{msg2_id}",
                            headers=_auth_headers(vic_token), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
        await expect_delete(dev_ws, msg2_id)

        # Dev sends a message; victim tries to delete it → 403
        dtext = f"devmsg-{uuid.uuid4().hex[:6]}"
        await dev_ws.send(json.dumps({"text": dtext}))
        dmsg = await collect_msg(vic_ws, dtext)
        dmsg_id = dmsg["id"]
        r = requests.delete(f"{BASE_URL}/api/chat/messages/{dmsg_id}",
                            headers=_auth_headers(vic_token), timeout=TIMEOUT)
        assert r.status_code == 403, r.text
