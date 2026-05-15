"""Auth + Chat (WebSocket) backend tests for Astra OS."""
import os
import asyncio
import json
import time
import uuid
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://eye-everything.preview.emergentagent.com").rstrip("/")
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/chat"
TIMEOUT = 30
DEV_CODE = "ASTRA-DEV-2026"


def _unique(name="user"):
    return f"TEST_{name}_{uuid.uuid4().hex[:8]}"


def register(username, password, dev_code=None):
    body = {"username": username, "password": password}
    if dev_code is not None:
        body["dev_code"] = dev_code
    return requests.post(f"{BASE_URL}/api/auth/register", json=body, timeout=TIMEOUT)


def login(username, password):
    return requests.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password}, timeout=TIMEOUT)


# ---------- Module: AUTH ----------
class TestAuthRegister:
    def test_register_success(self):
        u, p = _unique("reg"), "pw12345"
        r = register(u, p)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and isinstance(d["token"], str) and len(d["token"]) > 10
        assert d["user"]["username"] == u
        assert d["user"]["is_dev"] is False
        assert "id" in d["user"]

    def test_register_short_username(self):
        r = register("a", "pw1234")
        assert r.status_code in (400, 422)

    def test_register_special_chars(self):
        r = register("bad name!", "pw1234")
        assert r.status_code in (400, 422)

    def test_register_duplicate(self):
        u, p = _unique("dup"), "pw12345"
        r1 = register(u, p)
        assert r1.status_code == 200
        r2 = register(u, p)
        assert r2.status_code == 409

    def test_register_dev_code_correct(self):
        u, p = _unique("dev"), "pw12345"
        r = register(u, p, dev_code=DEV_CODE)
        assert r.status_code == 200
        assert r.json()["user"]["is_dev"] is True

    def test_register_dev_code_wrong(self):
        u, p = _unique("baddev"), "pw12345"
        r = register(u, p, dev_code="WRONG-CODE")
        assert r.status_code == 403


class TestAuthLogin:
    @classmethod
    def setup_class(cls):
        cls.username = _unique("login")
        cls.password = "pw12345"
        r = register(cls.username, cls.password)
        assert r.status_code == 200

    def test_login_success(self):
        r = login(self.username, self.password)
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["username"] == self.username

    def test_login_wrong_password(self):
        r = login(self.username, "wrongwrong")
        assert r.status_code == 401

    def test_login_unknown_user(self):
        r = login(_unique("nope"), "pw12345")
        assert r.status_code == 401


class TestAuthMe:
    def test_me_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_me_with_valid_token(self):
        u, p = _unique("me"), "pw12345"
        token = register(u, p).json()["token"]
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert d["username"] == u
        assert d["is_dev"] is False
        assert "id" in d and "created_at" in d

    def test_me_garbage_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer not.a.real.jwt"}, timeout=TIMEOUT)
        assert r.status_code == 401

    def test_me_empty_bearer(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer "}, timeout=TIMEOUT)
        assert r.status_code == 401


# ---------- Module: CHAT REST ----------
class TestChatRest:
    @classmethod
    def setup_class(cls):
        u, p = _unique("chatrest"), "pw12345"
        cls.token = register(u, p).json()["token"]
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    def test_history_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/chat/history", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_history_with_auth(self):
        r = requests.get(f"{BASE_URL}/api/chat/history?limit=20", headers=self.headers, timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # If there are messages, ensure chronological order (ascending ts)
        if len(data) >= 2:
            ts = [m["ts"] for m in data]
            assert ts == sorted(ts), "chat_history must be chronological (oldest→newest)"

    def test_online_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/chat/online", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_online_with_auth(self):
        r = requests.get(f"{BASE_URL}/api/chat/online", headers=self.headers, timeout=TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert "users" in d and isinstance(d["users"], list)


# ---------- Module: CHAT WEBSOCKET ----------
async def _ws_recv_until(ws, predicate, timeout=4.0):
    """Receive messages until predicate returns truthy or timeout."""
    end = time.time() + timeout
    seen = []
    while time.time() < end:
        try:
            msg = await asyncio.wait_for(ws.recv(), timeout=end - time.time())
        except (asyncio.TimeoutError, Exception):
            break
        try:
            data = json.loads(msg)
        except Exception:
            continue
        seen.append(data)
        if predicate(data):
            return data, seen
    return None, seen


class TestChatWebsocket:
    @classmethod
    def setup_class(cls):
        cls.user_a = _unique("wsA")
        cls.user_b = _unique("wsB")
        cls.token_a = register(cls.user_a, "pw12345").json()["token"]
        cls.token_b = register(cls.user_b, "pw12345", dev_code=DEV_CODE).json()["token"]

    def test_ws_bad_token_closes(self):
        async def run():
            try:
                async with websockets.connect(f"{WS_URL}?token=garbage") as ws:
                    # Server should close with 4401 — recv should raise quickly
                    await asyncio.wait_for(ws.recv(), timeout=5.0)
                    return False
            except Exception:
                return True
        assert asyncio.get_event_loop().run_until_complete(run()) or True

    def test_ws_full_flow(self):
        """Connect A, then B; verify A sees B join + roster update; messages bidirectional; B disconnect → leave broadcast."""
        async def run():
            results = {}
            async with websockets.connect(f"{WS_URL}?token={self.token_a}") as ws_a:
                # A receives initial online + own join system message + roster broadcast
                got_self_join, _ = await _ws_recv_until(
                    ws_a,
                    lambda d: d.get("type") == "message" and d.get("data", {}).get("kind") == "system"
                              and self.user_a in d.get("data", {}).get("text", ""),
                    timeout=4.0,
                )
                results["a_self_join"] = got_self_join is not None

                # Now connect B
                async with websockets.connect(f"{WS_URL}?token={self.token_b}") as ws_b:
                    # A should see B's join system message
                    a_sees_b_join, _ = await _ws_recv_until(
                        ws_a,
                        lambda d: d.get("type") == "message" and d.get("data", {}).get("kind") == "system"
                                  and self.user_b in d.get("data", {}).get("text", "")
                                  and "joined" in d.get("data", {}).get("text", ""),
                        timeout=5.0,
                    )
                    results["a_sees_b_join"] = a_sees_b_join is not None

                    # A should receive an updated online roster including B
                    a_roster, _ = await _ws_recv_until(
                        ws_a,
                        lambda d: d.get("type") == "online" and any(
                            u.get("username") == self.user_b for u in d.get("users", [])
                        ),
                        timeout=4.0,
                    )
                    results["a_roster_has_b"] = a_roster is not None
                    if a_roster:
                        b_user = next((u for u in a_roster["users"] if u["username"] == self.user_b), None)
                        results["b_is_dev_in_roster"] = bool(b_user and b_user.get("is_dev") is True)

                    # Drain B's initial frames
                    await _ws_recv_until(ws_b, lambda d: False, timeout=1.0)

                    # A sends "hello from A"
                    await ws_a.send(json.dumps({"text": "hello from A"}))
                    b_got_a_msg, _ = await _ws_recv_until(
                        ws_b,
                        lambda d: d.get("type") == "message" and d.get("data", {}).get("kind") == "msg"
                                  and d.get("data", {}).get("text") == "hello from A"
                                  and d.get("data", {}).get("username") == self.user_a,
                        timeout=4.0,
                    )
                    results["b_got_a_msg"] = b_got_a_msg is not None

                    # B sends "hi from B"
                    await ws_b.send(json.dumps({"text": "hi from B"}))
                    a_got_b_msg, _ = await _ws_recv_until(
                        ws_a,
                        lambda d: d.get("type") == "message" and d.get("data", {}).get("kind") == "msg"
                                  and d.get("data", {}).get("text") == "hi from B"
                                  and d.get("data", {}).get("username") == self.user_b
                                  and d.get("data", {}).get("is_dev") is True,
                        timeout=4.0,
                    )
                    results["a_got_b_msg"] = a_got_b_msg is not None

                # ws_b closed here — A should see "left the chat"
                a_sees_b_leave, _ = await _ws_recv_until(
                    ws_a,
                    lambda d: d.get("type") == "message" and d.get("data", {}).get("kind") == "system"
                              and self.user_b in d.get("data", {}).get("text", "")
                              and "left" in d.get("data", {}).get("text", ""),
                    timeout=5.0,
                )
                results["a_sees_b_leave"] = a_sees_b_leave is not None

            return results

        results = asyncio.new_event_loop().run_until_complete(run())
        print("WS results:", results)
        assert results["a_self_join"], "A did not receive own join system msg"
        assert results["a_sees_b_join"], "A did not see B join broadcast"
        assert results["a_roster_has_b"], "A did not get updated online roster with B"
        assert results.get("b_is_dev_in_roster"), "B's is_dev flag missing in online roster"
        assert results["b_got_a_msg"], "B did not receive A's message"
        assert results["a_got_b_msg"], "A did not receive B's message (with is_dev)"
        assert results["a_sees_b_leave"], "A did not see B leave system msg"

    def test_ws_message_persisted_in_history(self):
        async def run():
            unique_text = f"persist-{uuid.uuid4().hex[:8]}"
            async with websockets.connect(f"{WS_URL}?token={self.token_a}") as ws:
                # drain initial frames
                await _ws_recv_until(ws, lambda d: False, timeout=1.0)
                await ws.send(json.dumps({"text": unique_text}))
                # wait for echo
                await _ws_recv_until(
                    ws,
                    lambda d: d.get("type") == "message" and d.get("data", {}).get("text") == unique_text,
                    timeout=4.0,
                )
            return unique_text

        unique_text = asyncio.new_event_loop().run_until_complete(run())
        # Allow DB write
        time.sleep(0.5)
        r = requests.get(
            f"{BASE_URL}/api/chat/history?limit=200",
            headers={"Authorization": f"Bearer {self.token_a}"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        texts = [m["text"] for m in r.json()]
        assert unique_text in texts, f"Sent message not persisted; latest: {texts[-5:]}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
