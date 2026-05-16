# Astra OS — PRD

## Original Problem
User uploaded fragments of a desktop-OS web app and asked to: rebuild it cleanly, add account system + DEV mode, real-time chat, more apps/wallpapers, draggable icons, custom cursor — then evolved into: App Store, Dev Console with remote client control, hardware ban, chat moderation, and chrome-less native-style app windows.

## Architecture
- React 19 + craco + Tailwind base + lucide-react icons
- FastAPI + Motor (MongoDB) + bcrypt + PyJWT + httpx + WebSocket
- Auth: custom JWT (Bearer header), 30-day TTL, localStorage persistence
- Realtime: native FastAPI WebSocket with broadcast ConnectionManager
- Per-user data in MongoDB: `users` (unique username_lower; fingerprints[], last_fingerprint, is_banned, hw_banned), `chat_messages`, `events`, `config`, `banned_fingerprints`

## Implemented (full history)

### 2026-01-15 → 2026-02-05 — OS foundation
- Boot loader, draggable glass windows (focus/minimize/close), taskbar
- 10 apps: Browser, Chat, Settings, Notes, Terminal, Files, Calculator, Clock, Snake, Paint
- Auth gate (JWT register/login) + DEV mode via dev_code `201167`
- Custom Astra logo, 14 wallpapers, 5 animated backgrounds, 5 cursor styles
- Draggable desktop icons (localStorage), backend HTML proxy

### 2026-02-10 — App Store + Dev Console (v1)
- App Store (Featured / Install URL / Installed tabs)
- WebApp installer with iframe fallback card
- DevConsole v1: users tab (ban/unban/kick/notify/launch), events, blocked-words, broadcast
- ControlListener WS for receiving notify/launch/kicked

### 2026-02-12 — Admin power-up + Hardware ban + Chat moderation + Native apps  ✅ NEW
- **Hardware ban**: device fingerprinting (canvas+UA+screen+UUID) at `/app/frontend/src/lib/fingerprint.js`. Sent with every login/register/WS connect. Endpoints `/admin/users/{id}/hwban` and `/hwunban` ban every device fingerprint we've seen for the user — both login AND new registration from that device get 403.
- **Chat moderation**:
  - `/api/admin/chat/recent` admin moderation feed
  - `DELETE /api/admin/chat/{id}` (admin) and `DELETE /api/chat/messages/{id}` (own only)
  - Deletes broadcast `{type:"delete", id}` over WS — every connected client removes the message in real time
  - Hover-to-delete trash icon on every chat bubble (own messages for anyone, all messages for devs)
- **Remote client control — expanded**:
  - `notify` (popup), `launch` (open app), `navigate` (open URL in Browser), `closeall` (close every window), `force_logout` (sign user out), `takeover` (fullscreen banner), `kick`, `broadcast`
  - Dev Console row controls: collapse/expand with "Controls" button; each action has dedicated button + confirm prompts
- **Native-feeling app windows** (no more browser wrapper):
  - WebApp.js is chrome-less: no URL bar / back-forward buttons
  - Smart loading strategy per catalog entry: `direct` → `proxy` → `fallback`, or `embed` for services with official embed URLs (YouTube nocookie embed, Spotify embed)
  - Floating overlay (reload + external link) only visible on hover
  - Catalog updated: marks Discord/ChatGPT/X/Twitch/Reddit as `fallback` (they can't iframe), promotes Wikipedia/DuckDuckGo/Lobsters/Maps/Archive to `direct`, MDN/HN/GitHub through `proxy`
  - Sandboxed iframe with broad `allow` (autoplay, clipboard, encrypted-media, fullscreen, PIP)

## Backend Endpoints (current)
### Auth
- `POST /api/auth/register` `{username, password, dev_code?, fingerprint?}` → `{token, user}` — 403 if fingerprint banned
- `POST /api/auth/login`    `{username, password, fingerprint?}`           → `{token, user}` — 403 if banned or fingerprint banned
- `GET  /api/auth/me`       (Bearer)

### Chat
- `GET /api/chat/history?limit`     (Bearer)
- `GET /api/chat/online`            (Bearer)
- `DELETE /api/chat/messages/{id}`  (Bearer; own messages only)
- `WS  /api/ws/chat?token=<jwt>&fp=<fp>` — frames: `message`, `online`, `delete`, `notify`, `launch`, `navigate`, `closeall`, `force_logout`, `takeover`, `kicked`

### Browser proxy
- `GET /api/proxy?url=<...>` strips XFO/CSP, rewrites href/src
- `GET /api/proxy/health`

### Admin (dev only)
- `GET    /api/admin/users`
- `POST   /api/admin/users/{id}/ban`         `{reason?}`
- `POST   /api/admin/users/{id}/unban`
- `POST   /api/admin/users/{id}/hwban`       `{reason?}`
- `POST   /api/admin/users/{id}/hwunban`
- `POST   /api/admin/users/{id}/kick`
- `POST   /api/admin/users/{id}/notify`      `{title, body}`
- `POST   /api/admin/users/{id}/launch`      `{app}`
- `POST   /api/admin/users/{id}/navigate`    `{url}`
- `POST   /api/admin/users/{id}/closeall`
- `POST   /api/admin/users/{id}/logout`
- `POST   /api/admin/users/{id}/takeover`    `{title, body, duration_ms?}`
- `POST   /api/admin/broadcast`              `{title, body}`
- `GET    /api/admin/chat/recent?limit`
- `DELETE /api/admin/chat/{id}`
- `GET    /api/admin/events?limit`
- `GET/POST /api/admin/blocked-words`

## Test Credentials
See `/app/memory/test_credentials.md`. DEV code: `201167`.

## Verification (2026-02-12)
- Backend pytest: **5/5 pass** (auth+fingerprint, hwban end-to-end, chat delete, all 7 remote-control WS deliveries, broadcast)
- Frontend Playwright: **~95% pass** — DevConsole tabs/controls/HW-ban button verified; Chat hover-delete present; Discord fallback card renders; chrome-less variant confirmed (no `.ax-webapp-bar`).
- Manual curl smoke: hwban blocks both login AND registration from banned fingerprint; unban restores access.

## Backlog (P1)
- Refactor `/app/backend/server.py` (786 lines) into routers (`/routes/auth.py`, `/chat.py`, `/admin.py`, `/proxy.py`)
- SSRF hardening on `/api/proxy` (block private/loopback ranges; require Bearer)
- Make `delete_own_message` match on user_id (not username) so renames don't break it
- Disconnect existing WS connections whose `fp` is in `banned_fingerprints` (currently only checked at connect)
- Two-user automated chat regression (multi-browser context)

## Backlog (P2)
- Trending tab on the App Store
- Real per-user file storage in `Files` app
- More games (2048, Tetris)
- Right-click context menu on desktop
- File drag-drop between Files and Notes
- Window resize handles + persisted window sizes/positions
