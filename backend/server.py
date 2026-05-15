from fastapi import FastAPI, APIRouter, Query, Response
from fastapi.responses import HTMLResponse, PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
import httpx
from urllib.parse import urlparse, urljoin
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

BLOCKED_RESPONSE_HEADERS = {
    "content-security-policy",
    "content-security-policy-report-only",
    "x-frame-options",
    "x-content-security-policy",
    "x-webkit-csp",
    "cross-origin-opener-policy",
    "cross-origin-embedder-policy",
    "cross-origin-resource-policy",
    "permissions-policy",
    "feature-policy",
    "strict-transport-security",
    "transfer-encoding",
    "content-encoding",
    "content-length",
    "connection",
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
            or url.startswith("#")
            or url.startswith("javascript:")
            or url.startswith("mailto:")
            or url.startswith("data:")
            or url.startswith("blob:")
        ):
            return match.group(0)
        absolute = urljoin(base_url, url)
        return f'{attr}={quote}{proxy_prefix}{absolute}{quote}'

    # rewrite href/src/action
    html = re.sub(
        r'(href|src|action)=(["\'])(.*?)\2',
        rewrite_attr,
        html,
        flags=re.IGNORECASE,
    )
    # inject <base> tag so anything left untouched still resolves
    base_tag = f'<base href="{origin}/">'
    if "<head" in html.lower():
        html = re.sub(r"(<head[^>]*>)", r"\1" + base_tag, html, count=1, flags=re.IGNORECASE)
    else:
        html = base_tag + html
    return html


@app.get("/api/proxy")
async def proxy(url: str = Query(..., description="Absolute URL to fetch")):
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=20.0,
            headers={
                "User-Agent": PROXY_UA,
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
            },
        ) as client:
            r = await client.get(url)
    except Exception as e:  # noqa: BLE001
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


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()