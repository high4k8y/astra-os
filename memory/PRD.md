# Astra OS — PRD

## Original Problem
User uploaded fragments of a desktop-OS web app and asked to: rebuild it cleanly, add account system + DEV mode, real-time chat, more apps/wallpapers, draggable icons, and custom cursor.

## Architecture
- React 19 + craco + Tailwind base + lucide-react icons
- FastAPI + Motor (MongoDB) + bcrypt + PyJWT + httpx + WebSocket
- Auth: custom JWT (Bearer in Authorization header), 30-day TTL, localStorage persistence
- Realtime: native FastAPI WebSocket with broadcast ConnectionManager
- Per-user features keyed in MongoDB `users` (unique username_lower index), `chat_messages` (ts index)

## Implemented (2026-01-15 → 2026-05-15)
- Boot loader, draggable glass windows (focus/minimize/close), taskbar (logo, dock, user avatar, DEV chip, clock, logout)
- 10 apps: **Browser** (with backend `/api/proxy` to bypass X-Frame-Options + rewrite href/src), **Chat** (WebSocket realtime, history persistence, online roster, dev chips), **Settings** (5 tabs: Appearance/Wallpaper/Display/Account/System), **Notes** (auto-save + permanent caution banner), **Terminal** (+ `open <app>` command, Astra branding), **Files**, **Calculator**, **Clock** (live + stopwatch with laps), **Snake** (arrow/WASD, hi-score), **Paint** (canvas, 8 colors, 4 sizes, eraser, PNG export)
- **Auth gate**: JWT register/login, "I'm a developer" checkbox + dev code (`201167`) → `is_dev=true` → DEV chip
- **Custom Astra logo**: SVG combining "A" + orbit ring + sparkle motif from user reference sheet
- **14 wallpapers** (Earth, mountains, forests, sky, etc.)
- **Draggable desktop icons** with positions persisted to `astra-icon-positions`
- **Custom cursor** (dot + lerping ring with hover/click/text states), toggleable in Settings

## Backend Endpoints
- `POST /api/auth/register` `{username, password, dev_code?}` → `{token, user}`
- `POST /api/auth/login` `{username, password}` → `{token, user}`
- `GET /api/auth/me` (Bearer) → `UserOut`
- `GET /api/chat/history?limit=80` (Bearer) → list
- `GET /api/chat/online` (Bearer) → `{users}`
- `WS /api/ws/chat?token=<jwt>` → `{type:"message"|"online", ...}`
- `GET /api/proxy?url=<...>` → fetched HTML/asset with XFO/CSP stripped, links rewritten
- `GET /api/proxy/health`
- `GET /api/`, `POST /api/status`, `GET /api/status` (legacy)

## Test Credentials
See `/app/memory/test_credentials.md`. DEV code: `201167`.

## Verified
- Frontend lint clean; backend lint clean
- Backend tests 10/10 in iteration_1; iteration_2 backend test file written for auth+chat
- Manual e2e via screenshot tool: register dev → DEV chip → chat WS online → message round-trip → sign out → sign back in → desktop icon drag persists → all 10 apps render → 14 wallpapers in settings

## Backlog (P1)
- Window resize handles + persisted window positions
- Two-user automated chat regression (multi-context) — recommended next testing-agent run
- SSRF protection on `/api/proxy` (block private/loopback IPs) — flagged by previous testing agent

## Backlog (P2)
- More games (2048, Tetris)
- Music player app + AI chat app
- Right-click context menu on desktop
- File drag-drop between Files and Notes
