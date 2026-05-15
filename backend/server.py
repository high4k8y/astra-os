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


class LoginIn(BaseModel):
    username: str
    password: str


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


def user_to_out(u: dict) -> UserOut:
    return UserOut(
        id=u["id"],
        username=u["username"],
        is_dev=bool(u.get("is_dev", False)),
        created_at=u["created_at"] if isinstance(u["created_at"], datetime)
        else datetime.fromisoformat(u["created_at"]),
    )


# -------------------- AUTH ROUTES --------------------
@api_router.post("/auth/register", response_model=AuthOut)
async def register(payload: RegisterIn):
    uname = payload.username.strip()
    if not re.fullmatch(r"[A-Za-z0-9_\-]{2,24}", uname):
        raise HTTPException(status_code=400, detail="Username may use letters, numbers, _ or - (2-24 chars).")
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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    safe = {k: v for k, v in user.items() if k != "password_hash"}
    token = create_token(user["id"], user["username"], is_dev)
    return AuthOut(token=token, user=user_to_out(safe))


@api_router.post("/auth/login", response_model=AuthOut)
async def login(payload: LoginIn):
    u = await db.users.find_one({"username_lower": payload.username.strip().lower()})
    if not u or not verify_password(payload.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    token = create_token(u["id"], u["username"], bool(u.get("is_dev", False)))
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
async def ws_chat(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = decode_token(token)
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            await websocket.close(code=4401)
            return
    except Exception:
        await websocket.close(code=4401)
        return

    ws_id = await manager.connect(websocket, user)

    # send roster + system join
    try:
        await websocket.send_json({"type": "online", "users": manager.online_users()})
        join_doc = _msg_doc("system", f"{user['username']} joined the chat")
        await _save_and_broadcast(join_doc)
        await manager.broadcast({"type": "online", "users": manager.online_users()})

        while True:
            data = await websocket.receive_json()
            text = (data.get("text") or "").strip()
            if not text:
                continue
            text = text[:500]
            doc = _msg_doc("msg", text, user)
            await _save_and_broadcast(doc)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logging.warning("ws error: %s", e)
    finally:
        await manager.disconnect(ws_id)
        try:
            leave_doc = _msg_doc("system", f"{user['username']} left the chat")
            await _save_and_broadcast(leave_doc)
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
    "content-length", "connection",
}
PROXY_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _rewrite_html(html: str, base_url: str, proxy_prefix: str) -> str:
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"

    def rewrite_attr(match):
        attr = match.group(1)
        quote = match.group(2)
        url = match.group(3).strip()
        if (
            not url
            or url.startswith("#") or url.startswith("javascript:")
            or url.startswith("mailto:") or url.startswith("data:")
            or url.startswith("blob:")
        ):
            return match.group(0)
        absolute = urljoin(base_url, url)
        return f'{attr}={quote}{proxy_prefix}{absolute}{quote}'

    html = re.sub(
        r'(href|src|action)=(["\'])(.*?)\2', rewrite_attr, html, flags=re.IGNORECASE
    )
    base_tag = f'<base href="{origin}/">'
    if "<head" in html.lower():
        html = re.sub(r"(<head[^>]*>)", r"\1" + base_tag, html, count=1, flags=re.IGNORECASE)
    else:
        html = base_tag + html
    return html


@app.get("/api/proxy")
async def proxy(url: str = Query(...)):
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=20.0,
            headers={"User-Agent": PROXY_UA, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9"},
        ) as client_:
            r = await client_.get(url)
    except Exception as e:
        return HTMLResponse(
            f"<html><body style='font-family:monospace;background:#0f172a;color:#fda4af;padding:24px;'>"
            f"<h2>Proxy error</h2><p>{type(e).__name__}: {e}</p></body></html>",
            status_code=502,
        )

    content_type = r.headers.get("content-type", "application/octet-stream")
    body = r.content
    proxy_prefix = "/api/proxy?url="

    if "text/html" in content_type.lower():
        try:
            html = body.decode(r.encoding or "utf-8", errors="replace")
        except Exception:
            html = body.decode("utf-8", errors="replace")
        html = _rewrite_html(html, str(r.url), proxy_prefix)
        body = html.encode("utf-8")
        content_type = "text/html; charset=utf-8"

    out_headers = {}
    for k, v in r.headers.items():
        if k.lower() in BLOCKED_RESPONSE_HEADERS:
            continue
        out_headers[k] = v
    out_headers["content-type"] = content_type
    return Response(content=body, status_code=r.status_code, headers=out_headers)


@app.get("/api/proxy/health")
async def proxy_health():
    return {"ok": True, "service": "astra-proxy"}


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
