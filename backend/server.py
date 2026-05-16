from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import re
import logging
import asyncio
import bcrypt
import jwt
import httpx
from urllib.parse import urlparse, urljoin
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict
import uuid

from fastapi import (
    FastAPI, APIRouter, Query, Response, Depends, HTTPException, Request,
    WebSocket, WebSocketDisconnect, status,
)
from fastapi.responses import HTMLResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict


# -------------------- DB / APP --------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Astra OS API")
api_router = APIRouter(prefix="/api")

JWT_SECRET = os.environ["JWT_SECRET"]
DEV_CODE = os.environ.get("DEV_CODE", "ASTRA-DEV-2026")
JWT_ALG = "HS256"
JWT_EXPIRES_DAYS = 30


# -------------------- MODELS --------------------
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class RegisterIn(BaseModel):
    username: str = Field(min_length=2, max_length=24)
    password: str = Field(min_length=4, max_length=128)
    dev_code: Optional[str] = None
    fingerprint: Optional[str] = None


class LoginIn(BaseModel):
    username: str
    password: str
    fingerprint: Optional[str] = None


class UserOut(BaseModel):
    id: str
    username: str
    is_dev: bool
    created_at: datetime


class AuthOut(BaseModel):
    token: str
    user: UserOut


class ChatMessageOut(BaseModel):
    id: str
    kind: str  # "msg" | "system"
    username: Optional[str] = None
    is_dev: Optional[bool] = None
    text: str
    ts: datetime


# -------------------- AUTH HELPERS --------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, username: str, is_dev: bool) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "is_dev": is_dev,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def _is_fingerprint_banned(fp: Optional[str]) -> bool:
    if not fp:
        return False
    doc = await db.banned_fingerprints.find_one({"fp": fp}, {"_id": 0, "fp": 1})
    return bool(doc)


async def _remember_fingerprint(user_id: str, fp: Optional[str]):
    if not fp:
        return
    try:
        await db.users.update_one(
            {"id": user_id},
            {"$addToSet": {"fingerprints": fp}, "$set": {"last_fingerprint": fp}},
        )
    except Exception:
        pass


def user_to_out(u: dict) -> UserOut:
    return UserOut(
        id=u["id"],
        username=u["username"],
        is_dev=bool(u.get("is_dev", False)),
        created_at=u["created_at"] if isinstance(u["created_at"], datetime)
        else datetime.fromisoformat(u["created_at"]),
    )


# -------------------- AUTH ROUTES --------------------
SESSION_COOKIE = "astra_sess"
SESSION_COOKIE_MAX_AGE = JWT_EXPIRES_DAYS * 24 * 3600


def _set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_COOKIE_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def _decode_session_cookie(request: Request) -> Optional[str]:
    """Return user_id from astra_sess cookie if valid, else None."""
    tok = request.cookies.get(SESSION_COOKIE)
    if not tok:
        return None
    try:
        payload = decode_token(tok)
        return payload.get("sub")
    except Exception:
        return None


@api_router.post("/auth/register", response_model=AuthOut)
async def register(payload: RegisterIn, response: Response):
    uname = payload.username.strip()
    if not re.fullmatch(r"[A-Za-z0-9_\-]{2,24}", uname):
        raise HTTPException(status_code=400, detail="Username may use letters, numbers, _ or - (2-24 chars).")
    if await _is_fingerprint_banned(payload.fingerprint):
        raise HTTPException(status_code=403, detail="This device has been banned from Astra OS.")
    existing = await db.users.find_one({"username_lower": uname.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken.")

    is_dev = False
    if payload.dev_code:
        if payload.dev_code.strip() != DEV_CODE:
            raise HTTPException(status_code=403, detail="Invalid developer code.")
        is_dev = True

    user = {
        "id": str(uuid.uuid4()),
        "username": uname,
        "username_lower": uname.lower(),
        "password_hash": hash_password(payload.password),
        "is_dev": is_dev,
        "is_banned": False,
        "fingerprints": [payload.fingerprint] if payload.fingerprint else [],
        "last_fingerprint": payload.fingerprint or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    safe = {k: v for k, v in user.items() if k != "password_hash"}
    token = create_token(user["id"], user["username"], is_dev)
    _set_session_cookie(response, token)
    # Audit + broadcast a chat "joined" announcement (only on REGISTRATION, not on WS connect)
    await _log_event("register", user_id=user["id"], username=uname, meta={"is_dev": is_dev, "fp": payload.fingerprint or ""})
    try:
        join_doc = _msg_doc("system", f"{uname} joined Astra")
        await _save_and_broadcast(join_doc)
    except Exception:
        pass
    return AuthOut(token=token, user=user_to_out(safe))


@api_router.post("/auth/login", response_model=AuthOut)
async def login(payload: LoginIn, response: Response):
    u = await db.users.find_one({"username_lower": payload.username.strip().lower()})
    if not u or not verify_password(payload.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    if u.get("is_banned"):
        raise HTTPException(status_code=403, detail="This account has been banned.")
    if await _is_fingerprint_banned(payload.fingerprint):
        raise HTTPException(status_code=403, detail="This device has been banned from Astra OS.")
    await _remember_fingerprint(u["id"], payload.fingerprint)
    token = create_token(u["id"], u["username"], bool(u.get("is_dev", False)))
    _set_session_cookie(response, token)
    await _log_event("login", user_id=u["id"], username=u["username"], meta={"fp": payload.fingerprint or ""})
    return AuthOut(token=token, user=user_to_out(u))


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user_to_out(user)


# -------------------- CHAT --------------------
class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, dict] = {}  # ws_id -> {ws, user}
        self.lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, user: dict) -> str:
        await ws.accept()
        ws_id = str(uuid.uuid4())
        async with self.lock:
            self.connections[ws_id] = {"ws": ws, "user": user}
        return ws_id

    async def disconnect(self, ws_id: str):
        async with self.lock:
            self.connections.pop(ws_id, None)

    def online_users(self) -> List[dict]:
        seen = {}
        for c in self.connections.values():
            u = c["user"]
            seen[u["id"]] = {"id": u["id"], "username": u["username"], "is_dev": bool(u.get("is_dev", False))}
        return list(seen.values())

    async def broadcast(self, message: dict):
        dead = []
        for ws_id, c in list(self.connections.items()):
            try:
                await c["ws"].send_json(message)
            except Exception:
                dead.append(ws_id)
        for ws_id in dead:
            await self.disconnect(ws_id)

    async def send_to_user(self, user_id: str, message: dict) -> int:
        sent = 0
        for ws_id, c in list(self.connections.items()):
            if c["user"]["id"] == user_id:
                try:
                    await c["ws"].send_json(message)
                    sent += 1
                except Exception:
                    await self.disconnect(ws_id)
        return sent

    async def kick_user(self, user_id: str) -> int:
        kicked = 0
        for ws_id, c in list(self.connections.items()):
            if c["user"]["id"] == user_id:
                try:
                    await c["ws"].send_json({"type": "kicked", "reason": "Disconnected by an administrator."})
                    await c["ws"].close(code=4001)
                except Exception:
                    pass
                await self.disconnect(ws_id)
                kicked += 1
        return kicked


manager = ConnectionManager()


def _msg_doc(kind: str, text: str, user: Optional[dict] = None) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "kind": kind,
        "username": user["username"] if user else None,
        "is_dev": bool(user.get("is_dev", False)) if user else None,
        "text": text,
        "ts": datetime.now(timezone.utc).isoformat(),
    }


async def _log_event(action: str, user_id: Optional[str] = None, username: Optional[str] = None, meta: Optional[dict] = None):
    try:
        await db.events.insert_one({
            "id": str(uuid.uuid4()),
            "action": action,
            "user_id": user_id,
            "username": username,
            "meta": meta or {},
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logging.warning("event log failed: %s", e)


async def _blocked_words() -> List[str]:
    doc = await db.config.find_one({"_id": "blocked_words"}, {"_id": 0, "words": 1})
    return list(doc["words"]) if doc and "words" in doc else []


def _filter_message(text: str, blocked: List[str]) -> str:
    if not blocked or not text:
        return text
    out = text
    for w in blocked:
        if not w:
            continue
        pattern = re.compile(r"(?i)\b" + re.escape(w) + r"\b")
        out = pattern.sub("*" * max(3, len(w)), out)
    return out


async def _save_and_broadcast(doc: dict):
    await db.chat_messages.insert_one({**doc})
    out = {k: doc[k] for k in ("id", "kind", "username", "is_dev", "text", "ts")}
    await manager.broadcast({"type": "message", "data": out})


@api_router.get("/chat/history", response_model=List[ChatMessageOut])
async def chat_history(limit: int = 50, user: dict = Depends(get_current_user)):
    cursor = db.chat_messages.find({}, {"_id": 0}).sort("ts", -1).limit(min(max(limit, 1), 200))
    items = await cursor.to_list(length=limit)
    items.reverse()
    return [
        ChatMessageOut(
            id=m["id"], kind=m["kind"], username=m.get("username"),
            is_dev=m.get("is_dev"), text=m["text"],
            ts=m["ts"] if isinstance(m["ts"], datetime) else datetime.fromisoformat(m["ts"]),
        )
        for m in items
    ]


@api_router.get("/chat/online")
async def chat_online(user: dict = Depends(get_current_user)):
    return {"users": manager.online_users()}


@app.websocket("/api/ws/chat")
async def ws_chat(websocket: WebSocket, token: str = Query(...), fp: Optional[str] = Query(None)):
    try:
        payload = decode_token(token)
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            await websocket.close(code=4401)
            return
        if user.get("is_banned"):
            await websocket.close(code=4003)
            return
        if await _is_fingerprint_banned(fp):
            await websocket.close(code=4003)
            return
        if fp:
            await _remember_fingerprint(user["id"], fp)
    except Exception:
        await websocket.close(code=4401)
        return

    ws_id = await manager.connect(websocket, user)

    # Send initial roster + recent history (no "joined the chat" spam — that happens on registration)
    try:
        await websocket.send_json({"type": "online", "users": manager.online_users()})
        await manager.broadcast({"type": "online", "users": manager.online_users()})

        while True:
            data = await websocket.receive_json()
            text = (data.get("text") or "").strip()
            if not text:
                continue
            text = text[:500]
            blocked = await _blocked_words()
            text = _filter_message(text, blocked)
            doc = _msg_doc("msg", text, user)
            await _save_and_broadcast(doc)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logging.warning("ws error: %s", e)
    finally:
        await manager.disconnect(ws_id)
        try:
            await manager.broadcast({"type": "online", "users": manager.online_users()})
        except Exception:
            pass


# -------------------- HELLO + STATUS (legacy) --------------------
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    obj = StatusCheck(**input.model_dump())
    doc = obj.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await db.status_checks.insert_one(doc)
    return obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    rows = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for r in rows:
        if isinstance(r["timestamp"], str):
            r["timestamp"] = datetime.fromisoformat(r["timestamp"])
    return rows


# -------------------- PROXY (browser app) --------------------
BLOCKED_RESPONSE_HEADERS = {
    "content-security-policy", "content-security-policy-report-only",
    "x-frame-options", "x-content-security-policy", "x-webkit-csp",
    "cross-origin-opener-policy", "cross-origin-embedder-policy",
    "cross-origin-resource-policy", "permissions-policy", "feature-policy",
    "strict-transport-security", "transfer-encoding", "content-encoding",
    "content-length", "connection", "referrer-policy",
    "x-content-type-options", "report-to", "expect-ct", "nel",
    "alt-svc", "set-cookie",  # cookies for foreign origins break iframe sandbox anyway
}
PROXY_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
PROXY_PREFIX = "/api/proxy?url="


def _abs_or_skip(raw: str, base_url: str) -> Optional[str]:
    """Return absolute http(s) URL or None if this looks like a non-network ref."""
    if not raw:
        return None
    s = raw.strip().strip('"\'')
    if (not s
            or s.startswith("#")
            or s.startswith("javascript:")
            or s.startswith("mailto:")
            or s.startswith("tel:")
            or s.startswith("data:")
            or s.startswith("blob:")
            or s.startswith("about:")
            or s.startswith("ws:") or s.startswith("wss:")):
        return None
    try:
        abs_ = urljoin(base_url, s)
    except Exception:
        return None
    if not abs_.startswith(("http://", "https://")):
        return None
    return abs_


def _wrap(abs_url: str) -> str:
    from urllib.parse import quote
    return PROXY_PREFIX + quote(abs_url, safe="")


def _rewrite_css(css: str, base_url: str) -> str:
    """Rewrite url(...) and @import inside CSS."""
    def repl_url(m):
        inner = m.group(1)
        abs_ = _abs_or_skip(inner, base_url)
        return f'url("{_wrap(abs_)}")' if abs_ else m.group(0)

    css = re.sub(r"url\(\s*([^)]+?)\s*\)", repl_url, css, flags=re.IGNORECASE)

    def repl_import(m):
        inner = m.group(1)
        abs_ = _abs_or_skip(inner, base_url)
        return f'@import "{_wrap(abs_)}"' if abs_ else m.group(0)

    css = re.sub(r"@import\s+(?:url\(\s*)?[\"']?([^\"')]+)[\"']?\s*\)?", repl_import, css, flags=re.IGNORECASE)
    return css


def _rewrite_srcset(value: str, base_url: str) -> str:
    """Rewrite a srcset attribute value (comma-separated `url descriptor` pairs)."""
    out = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        bits = part.split(None, 1)
        u = bits[0]
        descriptor = (" " + bits[1]) if len(bits) > 1 else ""
        abs_ = _abs_or_skip(u, base_url)
        out.append((_wrap(abs_) if abs_ else u) + descriptor)
    return ", ".join(out)


JS_SHIM_TEMPLATE = """
<script>(function(){
  var PFX='%(prefix)s';
  var ORIGIN='%(origin)s';
  function abs(u){ try { return new URL(u, ORIGIN).toString(); } catch(e){ return null; } }
  function wrap(u){
    if (u==null) return u;
    if (typeof u !== 'string') return u;
    if (!u || u.indexOf(PFX)===0) return u;
    var lo = u.toLowerCase();
    if (lo.indexOf('data:')===0 || lo.indexOf('blob:')===0 || lo.indexOf('javascript:')===0
        || lo.indexOf('about:')===0 || lo.indexOf('#')===0
        || lo.indexOf('ws:')===0 || lo.indexOf('wss:')===0
        || lo.indexOf('mailto:')===0 || lo.indexOf('tel:')===0) return u;
    var a = abs(u);
    if (!a) return u;
    if (!/^https?:\\/\\//i.test(a)) return u;
    return PFX + encodeURIComponent(a);
  }
  // fetch
  if (window.fetch) {
    var _f = window.fetch.bind(window);
    window.fetch = function(input, init){
      try {
        if (typeof input === 'string') return _f(wrap(input), init);
        if (input && input.url) return _f(new Request(wrap(input.url), input), init);
      } catch(e) {}
      return _f(input, init);
    };
  }
  // XHR
  var _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u){
    try { u = wrap(u); } catch(e){}
    var args = [m, u].concat(Array.prototype.slice.call(arguments, 2));
    return _xhrOpen.apply(this, args);
  };
  // Image / Audio / Video / Script / Link src setters
  ['HTMLImageElement','HTMLScriptElement','HTMLIFrameElement','HTMLMediaElement','HTMLSourceElement','HTMLEmbedElement','HTMLObjectElement'].forEach(function(tag){
    try {
      var proto = window[tag] && window[tag].prototype;
      if (!proto) return;
      ['src','data'].forEach(function(prop){
        var d = Object.getOwnPropertyDescriptor(proto, prop);
        if (!d || !d.set) return;
        Object.defineProperty(proto, prop, {
          configurable: true, enumerable: true,
          get: d.get,
          set: function(v){ d.set.call(this, wrap(v)); }
        });
      });
    } catch(e){}
  });
  // Anchor.href clicks: rewrite when set after parse
  try {
    var hd = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'href');
    if (hd && hd.set) {
      Object.defineProperty(HTMLAnchorElement.prototype, 'href', {
        configurable: true, enumerable: true,
        get: hd.get,
        set: function(v){ hd.set.call(this, wrap(v)); }
      });
    }
  } catch(e){}
  // window.open: keep popups inside the proxied frame
  if (window.open) {
    var _o = window.open;
    window.open = function(u, t, f){ try { u = wrap(u); } catch(e){} return _o.call(window, u, t, f); };
  }
  // Form submissions
  document.addEventListener('submit', function(ev){
    try {
      var f = ev.target;
      if (f && f.tagName === 'FORM' && f.action) f.action = wrap(f.action);
    } catch(e){}
  }, true);
  // WebSocket — best-effort: block (most cross-origin WS will fail anyway)
  try {
    var _WS = window.WebSocket;
    window.WebSocket = function(u, p){ console.warn('[astra-proxy] WebSocket blocked:', u); throw new Error('WebSocket disabled inside Astra proxy'); };
    window.WebSocket.prototype = _WS && _WS.prototype;
  } catch(e){}
})();</script>
"""


def _rewrite_html(html: str, base_url: str) -> str:
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"

    def rewrite_attr(match):
        attr = match.group(1)
        quote_c = match.group(2)
        raw_url = match.group(3)
        abs_ = _abs_or_skip(raw_url, base_url)
        if not abs_:
            return match.group(0)
        return f'{attr}={quote_c}{_wrap(abs_)}{quote_c}'

    # href/src/action/poster/formaction/data/cite — common URL-bearing attrs
    html = re.sub(
        r'(href|src|action|poster|formaction|data|cite|background)=(["\'])(.*?)\2',
        rewrite_attr, html, flags=re.IGNORECASE,
    )

    # srcset
    def rewrite_srcset(m):
        return f'srcset={m.group(1)}{_rewrite_srcset(m.group(2), base_url)}{m.group(1)}'
    html = re.sub(r'srcset=(["\'])(.*?)\1', rewrite_srcset, html, flags=re.IGNORECASE)

    # inline style="...url(...)..."
    def rewrite_inline_style(m):
        full = m.group(0)
        inner = m.group(2)
        return full.replace(inner, _rewrite_css(inner, base_url))
    html = re.sub(r'style=(["\'])(.*?)\1', rewrite_inline_style, html, flags=re.IGNORECASE | re.DOTALL)

    # <style>...</style> blocks
    def rewrite_style_block(m):
        return f"<style{m.group(1)}>{_rewrite_css(m.group(2), base_url)}</style>"
    html = re.sub(r'<style([^>]*)>(.*?)</style>', rewrite_style_block, html, flags=re.IGNORECASE | re.DOTALL)

    # <meta http-equiv="refresh" content="0;url=..."> — rewrite the URL
    def rewrite_meta_refresh(m):
        content = m.group(2)
        new_content = re.sub(
            r"(url\s*=\s*)(['\"]?)([^'\";>]+)\2",
            lambda mm: f"{mm.group(1)}{mm.group(2)}{_wrap(_abs_or_skip(mm.group(3), base_url) or mm.group(3))}{mm.group(2)}",
            content, flags=re.IGNORECASE,
        )
        return m.group(0).replace(content, new_content)
    html = re.sub(
        r'(<meta[^>]+http-equiv=["\']refresh["\'][^>]+content=["\'])([^"\']+)(["\'])',
        rewrite_meta_refresh, html, flags=re.IGNORECASE,
    )

    # Inject JS shim + <base> right after <head>
    shim = JS_SHIM_TEMPLATE % {"prefix": PROXY_PREFIX, "origin": origin}
    base_tag = f'<base href="{origin}/">'
    head_match = re.search(r"<head[^>]*>", html, flags=re.IGNORECASE)
    if head_match:
        idx = head_match.end()
        html = html[:idx] + base_tag + shim + html[idx:]
    else:
        html = "<!doctype html><html><head>" + base_tag + shim + "</head>" + html
    return html


def _strip_block_headers(src: dict) -> dict:
    out = {}
    for k, v in src.items():
        if k.lower() in BLOCKED_RESPONSE_HEADERS:
            continue
        out[k] = v
    return out


def _candidate_cookie_domains(host: str) -> List[str]:
    """Domains a Cookie should match when sent upstream (exact host + parent suffixes)."""
    host = host.lower().split(":")[0]
    out = {host, "." + host}
    parts = host.split(".")
    for i in range(1, len(parts) - 1):
        s = ".".join(parts[i:])
        out.add(s)
        out.add("." + s)
    return list(out)


async def _load_user_cookies_for(user_id: str, host: str) -> str:
    """Build the Cookie header value for an upstream request."""
    if not user_id:
        return ""
    domains = _candidate_cookie_domains(host)
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor = db.proxy_cookies.find(
        {
            "user_id": user_id,
            "domain": {"$in": domains},
            "$or": [{"expires": None}, {"expires": {"$gt": now_iso}}],
        },
        {"_id": 0, "name": 1, "value": 1},
    )
    out = []
    seen = set()
    async for c in cursor:
        if c["name"] in seen:
            continue
        seen.add(c["name"])
        out.append(f'{c["name"]}={c["value"]}')
    return "; ".join(out)


def _parse_set_cookie(raw: str, default_host: str):
    """Best-effort Set-Cookie parser. Returns dict or None."""
    if not raw or "=" not in raw:
        return None
    parts = [p.strip() for p in raw.split(";") if p.strip()]
    nv = parts[0].split("=", 1)
    if len(nv) != 2:
        return None
    name, value = nv[0].strip(), nv[1].strip()
    if not name:
        return None
    attrs = {}
    for p in parts[1:]:
        if "=" in p:
            k, v = p.split("=", 1)
            attrs[k.strip().lower()] = v.strip()
        else:
            attrs[p.strip().lower()] = True
    domain = attrs.get("domain") or default_host
    domain = domain.lower().lstrip(".")
    expires = None
    if "max-age" in attrs:
        try:
            expires = (datetime.now(timezone.utc) + timedelta(seconds=int(attrs["max-age"]))).isoformat()
        except Exception:
            pass
    elif "expires" in attrs:
        try:
            from email.utils import parsedate_to_datetime
            expires = parsedate_to_datetime(attrs["expires"]).astimezone(timezone.utc).isoformat()
        except Exception:
            pass
    return {
        "name": name, "value": value, "domain": domain,
        "path": attrs.get("path", "/"), "expires": expires,
    }


async def _persist_set_cookies(user_id: str, default_host: str, set_cookies: List[str]):
    if not user_id or not set_cookies:
        return
    for raw in set_cookies:
        c = _parse_set_cookie(raw, default_host)
        if not c:
            continue
        await db.proxy_cookies.update_one(
            {"user_id": user_id, "domain": c["domain"], "name": c["name"]},
            {"$set": {**c, "user_id": user_id}},
            upsert=True,
        )


@app.get("/api/proxy")
async def proxy(url: str = Query(...), request: Request = None):
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    user_id = _decode_session_cookie(request) if request is not None else None
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    request_origin = f"{parsed.scheme}://{parsed.netloc}"

    upstream_cookie = await _load_user_cookies_for(user_id, host) if user_id else ""
    upstream_headers = {
        "User-Agent": PROXY_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "Referer": request_origin + "/",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Upgrade-Insecure-Requests": "1",
        "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }
    if upstream_cookie:
        upstream_headers["Cookie"] = upstream_cookie

    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=25.0, headers=upstream_headers,
        ) as client_:
            r = await client_.get(url)
    except Exception as e:
        return HTMLResponse(
            f"<html><body style='font-family:monospace;background:#0f172a;color:#fda4af;padding:24px;'>"
            f"<h2>Proxy error</h2><p>{type(e).__name__}: {e}</p></body></html>",
            status_code=502,
        )

    # Persist any Set-Cookie headers under the current user (across redirect chain)
    if user_id:
        try:
            collected: List[str] = []
            for hop in list(r.history) + [r]:
                hop_host = (urlparse(str(hop.url)).netloc or host).lower()
                try:
                    sc = hop.headers.get_list("set-cookie")
                except Exception:
                    raw = hop.headers.get("set-cookie")
                    sc = [raw] if raw else []
                for raw in sc:
                    collected.append(f"{hop_host}\n{raw}")
            # Group by host
            for entry in collected:
                hh, _, raw = entry.partition("\n")
                await _persist_set_cookies(user_id, hh, [raw])
        except Exception:
            pass

    content_type = r.headers.get("content-type", "application/octet-stream")
    ctype_lc = content_type.lower()
    body = r.content
    final_url = str(r.url)

    # Detect bot-blocked / anti-scraping responses and surface a friendly page
    is_blocked = False
    if r.status_code in (401, 403, 429) and len(body) < 1500:
        is_blocked = True
    elif len(body) < 800:
        try:
            if any(s in body.lower() for s in (b"robot policy", b"cloudflare", b"access denied")):
                is_blocked = True
        except Exception:
            pass

    if is_blocked:
        try:
            preview = body.decode(r.encoding or "utf-8", errors="replace")[:300]
        except Exception:
            preview = ""
        # Same-iframe friendly page — nothing escapes Astra OS
        retry_url = PROXY_PREFIX + final_url
        friendly = (
            f"<!doctype html><html><head><base href='{request_origin}/'><meta charset='utf-8'>"
            f"<title>{parsed.netloc} · blocked</title>"
            "<style>body{margin:0;background:#0b0b12;color:#e6edff;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}"
            ".c{max-width:520px;text-align:center}.t{font-size:22px;font-weight:700;margin-bottom:12px;letter-spacing:.3px}"
            ".b{font-size:14px;line-height:1.55;color:#94a3b8;margin-bottom:18px}"
            ".u{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#64748b;margin-bottom:18px;word-break:break-all}"
            ".btn{display:inline-block;padding:10px 22px;background:#6366f1;color:white;text-decoration:none;border:none;cursor:pointer;border-radius:8px;font-weight:600;font-size:13px;font-family:inherit}"
            ".btn:hover{filter:brightness(1.1)}"
            "</style></head><body><div class='c'>"
            f"<div class='t'>{parsed.netloc} blocked the proxy</div>"
            "<div class='b'>This site challenges automated requests "
            "(Cloudflare bot check, rate limiting, or login wall). "
            "Try reloading — or if you've signed in here before, your cookies will carry over next time.</div>"
            f"<div class='u'>HTTP {r.status_code} · {preview}</div>"
            f"<button class='btn' onclick=\"location.href='{retry_url}'\">Try again</button>"
            "</div></body></html>"
        )
        return Response(
            content=friendly.encode("utf-8"),
            status_code=200,
            headers={"content-type": "text/html; charset=utf-8", "access-control-allow-origin": "*"},
        )

    if "text/html" in ctype_lc:
        try:
            html = body.decode(r.encoding or "utf-8", errors="replace")
        except Exception:
            html = body.decode("utf-8", errors="replace")
        html = _rewrite_html(html, final_url)
        body = html.encode("utf-8")
        content_type = "text/html; charset=utf-8"
    elif "text/css" in ctype_lc:
        try:
            css = body.decode(r.encoding or "utf-8", errors="replace")
        except Exception:
            css = body.decode("utf-8", errors="replace")
        css = _rewrite_css(css, final_url)
        body = css.encode("utf-8")
        content_type = "text/css; charset=utf-8"

    out_headers = _strip_block_headers(dict(r.headers))
    out_headers["content-type"] = content_type
    # Allow embedding in our own origin
    out_headers["access-control-allow-origin"] = "*"
    return Response(content=body, status_code=r.status_code, headers=out_headers)


@app.post("/api/proxy/clear-cookies")
async def proxy_clear_cookies(user: dict = Depends(get_current_user)):
    """Erase every cookie the proxy has stored for the current user."""
    res = await db.proxy_cookies.delete_many({"user_id": user["id"]})
    return {"ok": True, "deleted": res.deleted_count}


@app.get("/api/proxy/health")
async def proxy_health():
    return {"ok": True, "service": "astra-proxy"}


# -------------------- ADMIN (is_dev only) --------------------
async def get_dev_user(user: dict = Depends(get_current_user)) -> dict:
    if not bool(user.get("is_dev", False)):
        raise HTTPException(status_code=403, detail="Developer access required.")
    return user


class BanIn(BaseModel):
    reason: Optional[str] = None


class BlockedWordsIn(BaseModel):
    words: List[str]


class NotifyIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=1, max_length=400)


class LaunchIn(BaseModel):
    app: str = Field(min_length=1, max_length=64)


class NavigateIn(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


class TakeoverIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=1, max_length=600)
    duration_ms: int = Field(default=6000, ge=500, le=120000)


@api_router.get("/admin/users")
async def admin_users(_: dict = Depends(get_dev_user)):
    rows = await db.users.find(
        {}, {"_id": 0, "password_hash": 0, "username_lower": 0}
    ).sort("created_at", -1).to_list(500)
    online_ids = {u["id"] for u in manager.online_users()}
    for r in rows:
        r["online"] = r["id"] in online_ids
    return {"users": rows}


@api_router.post("/admin/users/{user_id}/ban")
async def admin_ban(user_id: str, payload: BanIn, dev: dict = Depends(get_dev_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "username": 1, "is_dev": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.get("is_dev"):
        raise HTTPException(status_code=400, detail="Cannot ban a developer account.")
    await db.users.update_one({"id": user_id}, {"$set": {"is_banned": True, "ban_reason": payload.reason or ""}})
    await _log_event("ban", user_id=user_id, username=target["username"], meta={"by": dev["username"], "reason": payload.reason or ""})
    kicked = await manager.kick_user(user_id)
    await manager.broadcast({"type": "online", "users": manager.online_users()})
    return {"ok": True, "kicked": kicked}


@api_router.post("/admin/users/{user_id}/unban")
async def admin_unban(user_id: str, dev: dict = Depends(get_dev_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "username": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    await db.users.update_one({"id": user_id}, {"$set": {"is_banned": False}, "$unset": {"ban_reason": ""}})
    await _log_event("unban", user_id=user_id, username=target["username"], meta={"by": dev["username"]})
    return {"ok": True}


@api_router.post("/admin/users/{user_id}/kick")
async def admin_kick(user_id: str, dev: dict = Depends(get_dev_user)):
    kicked = await manager.kick_user(user_id)
    await manager.broadcast({"type": "online", "users": manager.online_users()})
    await _log_event("kick", user_id=user_id, meta={"by": dev["username"], "kicked": kicked})
    return {"ok": True, "kicked": kicked}


@api_router.post("/admin/users/{user_id}/notify")
async def admin_notify(user_id: str, payload: NotifyIn, dev: dict = Depends(get_dev_user)):
    sent = await manager.send_to_user(user_id, {
        "type": "notify",
        "title": payload.title,
        "body": payload.body,
        "from": dev["username"],
    })
    await _log_event("notify", user_id=user_id, meta={"by": dev["username"], "title": payload.title})
    return {"ok": True, "sent": sent}


@api_router.post("/admin/users/{user_id}/launch")
async def admin_launch(user_id: str, payload: LaunchIn, dev: dict = Depends(get_dev_user)):
    sent = await manager.send_to_user(user_id, {
        "type": "launch",
        "app": payload.app,
        "from": dev["username"],
    })
    await _log_event("launch", user_id=user_id, meta={"by": dev["username"], "app": payload.app})
    return {"ok": True, "sent": sent}


@api_router.post("/admin/users/{user_id}/navigate")
async def admin_navigate(user_id: str, payload: NavigateIn, dev: dict = Depends(get_dev_user)):
    sent = await manager.send_to_user(user_id, {
        "type": "navigate",
        "url": payload.url,
        "from": dev["username"],
    })
    await _log_event("navigate", user_id=user_id, meta={"by": dev["username"], "url": payload.url})
    return {"ok": True, "sent": sent}


@api_router.post("/admin/users/{user_id}/closeall")
async def admin_closeall(user_id: str, dev: dict = Depends(get_dev_user)):
    sent = await manager.send_to_user(user_id, {"type": "closeall", "from": dev["username"]})
    await _log_event("closeall", user_id=user_id, meta={"by": dev["username"]})
    return {"ok": True, "sent": sent}


@api_router.post("/admin/users/{user_id}/logout")
async def admin_force_logout(user_id: str, dev: dict = Depends(get_dev_user)):
    sent = await manager.send_to_user(user_id, {"type": "force_logout", "from": dev["username"]})
    await _log_event("force_logout", user_id=user_id, meta={"by": dev["username"]})
    return {"ok": True, "sent": sent}


@api_router.post("/admin/users/{user_id}/takeover")
async def admin_takeover(user_id: str, payload: TakeoverIn, dev: dict = Depends(get_dev_user)):
    sent = await manager.send_to_user(user_id, {
        "type": "takeover",
        "title": payload.title,
        "body": payload.body,
        "duration_ms": payload.duration_ms,
        "from": dev["username"],
    })
    await _log_event("takeover", user_id=user_id, meta={"by": dev["username"], "title": payload.title})
    return {"ok": True, "sent": sent}


@api_router.post("/admin/users/{user_id}/hwban")
async def admin_hwban(user_id: str, payload: BanIn, dev: dict = Depends(get_dev_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "username": 1, "is_dev": 1, "fingerprints": 1, "last_fingerprint": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target.get("is_dev"):
        raise HTTPException(status_code=400, detail="Cannot hardware-ban a developer account.")
    fps = list(target.get("fingerprints") or [])
    if target.get("last_fingerprint") and target["last_fingerprint"] not in fps:
        fps.append(target["last_fingerprint"])
    fps = [f for f in fps if f]
    if not fps:
        raise HTTPException(status_code=400, detail="No device fingerprint recorded for this user yet.")
    now = datetime.now(timezone.utc).isoformat()
    for fp in fps:
        await db.banned_fingerprints.update_one(
            {"fp": fp},
            {"$set": {"fp": fp, "username": target["username"], "user_id": user_id, "reason": payload.reason or "", "by": dev["username"], "ts": now}},
            upsert=True,
        )
    await db.users.update_one({"id": user_id}, {"$set": {"is_banned": True, "ban_reason": payload.reason or "", "hw_banned": True}})
    await _log_event("hwban", user_id=user_id, username=target["username"], meta={"by": dev["username"], "reason": payload.reason or "", "fp_count": len(fps)})
    kicked = await manager.kick_user(user_id)
    await manager.broadcast({"type": "online", "users": manager.online_users()})
    return {"ok": True, "kicked": kicked, "fingerprints_banned": len(fps)}


@api_router.post("/admin/users/{user_id}/hwunban")
async def admin_hwunban(user_id: str, dev: dict = Depends(get_dev_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "username": 1, "fingerprints": 1, "last_fingerprint": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    fps = list(target.get("fingerprints") or [])
    if target.get("last_fingerprint") and target["last_fingerprint"] not in fps:
        fps.append(target["last_fingerprint"])
    fps = [f for f in fps if f]
    if fps:
        await db.banned_fingerprints.delete_many({"fp": {"$in": fps}})
    await db.users.update_one({"id": user_id}, {"$set": {"is_banned": False, "hw_banned": False}, "$unset": {"ban_reason": ""}})
    await _log_event("hwunban", user_id=user_id, username=target["username"], meta={"by": dev["username"], "fp_count": len(fps)})
    return {"ok": True, "fingerprints_unbanned": len(fps)}


@api_router.get("/admin/chat/recent")
async def admin_chat_recent(limit: int = 100, _: dict = Depends(get_dev_user)):
    cursor = db.chat_messages.find({}, {"_id": 0}).sort("ts", -1).limit(min(max(limit, 1), 500))
    items = await cursor.to_list(length=limit)
    return {"messages": items}


@api_router.delete("/admin/chat/{message_id}")
async def admin_delete_message(message_id: str, dev: dict = Depends(get_dev_user)):
    res = await db.chat_messages.delete_one({"id": message_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found.")
    await manager.broadcast({"type": "delete", "id": message_id, "by": dev["username"]})
    await _log_event("chat_delete", username=dev["username"], meta={"id": message_id})
    return {"ok": True}


@api_router.delete("/chat/messages/{message_id}")
async def delete_own_message(message_id: str, user: dict = Depends(get_current_user)):
    msg = await db.chat_messages.find_one({"id": message_id}, {"_id": 0, "username": 1, "kind": 1})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
    if msg.get("kind") != "msg" or msg.get("username") != user["username"]:
        raise HTTPException(status_code=403, detail="You can only delete your own messages.")
    await db.chat_messages.delete_one({"id": message_id})
    await manager.broadcast({"type": "delete", "id": message_id, "by": user["username"]})
    return {"ok": True}


@api_router.post("/admin/broadcast")
async def admin_broadcast(payload: NotifyIn, dev: dict = Depends(get_dev_user)):
    await manager.broadcast({
        "type": "notify",
        "title": payload.title,
        "body": payload.body,
        "from": dev["username"],
        "broadcast": True,
    })
    await _log_event("broadcast", username=dev["username"], meta={"title": payload.title})
    return {"ok": True}


@api_router.get("/admin/events")
async def admin_events(limit: int = 100, _: dict = Depends(get_dev_user)):
    cursor = db.events.find({}, {"_id": 0}).sort("ts", -1).limit(min(max(limit, 1), 500))
    return {"events": await cursor.to_list(length=limit)}


@api_router.get("/admin/blocked-words")
async def admin_get_blocked_words(_: dict = Depends(get_dev_user)):
    return {"words": await _blocked_words()}


@api_router.post("/admin/blocked-words")
async def admin_set_blocked_words(payload: BlockedWordsIn, dev: dict = Depends(get_dev_user)):
    cleaned = [w.strip() for w in payload.words if w and w.strip()][:200]
    await db.config.update_one(
        {"_id": "blocked_words"}, {"$set": {"words": cleaned}}, upsert=True
    )
    await _log_event("blocked_words_update", username=dev["username"], meta={"count": len(cleaned)})
    return {"ok": True, "words": cleaned}


# -------------------- FINALIZE --------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def _on_start():
    try:
        await db.users.create_index("username_lower", unique=True)
        await db.chat_messages.create_index("ts")
    except Exception as e:
        logger.warning("Index creation issue: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
