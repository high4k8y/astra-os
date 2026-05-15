# NEXUS OS — Product Requirements Doc

## Original Problem Statement
User uploaded `file.html`, `file.css`, `file.js`, `file.json` (and later React/TS fragments) for a desktop-OS web app and said: "look t evreything" (look at everything). Files were mismatched — HTML had 3 apps inline; CSS+JS were a richer 6-app version not wired together.

## Decision
Rebuild as a polished pure-frontend React app inside `/app/frontend` (option **b**), merging all 6 apps from the newer CSS+JS, localStorage persistence, no backend writes.

## Architecture
- React 19 + craco + Tailwind base (existing scaffold)
- Single `App.js` shell + `SettingsContext` for global appearance state
- One `Window` component (drag + z-index focus + minimize/close)
- 6 app components in `src/os/apps/`
- All styles in `src/os/os.css` (CSS variables driven by settings)
- LocalStorage keys: `nexus-os-settings`, `nexus-notes`
- Backend `server.py` left untouched (Hello World + status check endpoints)

## Implemented (2026-01-15)
- ✅ Boot loader (animated ring + progress bar, 2.4s)
- ✅ Desktop with 6 icons: Network, Settings, Notes, Terminal, Files, Calculator
- ✅ Glassmorphism windows: draggable header, z-index focus, minimize, close
- ✅ Taskbar: logo, dock with active-app indicator, clock
- ✅ Settings app: 12 accent colors, 6 wallpapers, blur/transparency/font-size sliders, RGB mode toggle, reset/reboot
- ✅ Notes app: auto-save to localStorage with status indicator + clear
- ✅ Terminal app: help/clear/date/whoami/echo/ls/neofetch/reboot + command history (↑/↓)
- ✅ Calculator app: safe expression eval, ± / % operators
- ✅ Network app: iframe browser w/ home page, URL bar, search fallback (DuckDuckGo)
- ✅ Files app: static file grid mock
- ✅ data-testid on every interactive element

## Verified
- Lint: clean
- Frontend compiles successfully
- Manual e2e via screenshot tool: boot → desktop → multi-window → calc 2+3=5 → terminal commands → accent/RGB toggle all working

## Future / Backlog (P1)
- Window resize handles
- Persist window positions across reload
- Right-click context menu on desktop
- Music player app (visualizer + uploaded files)
- Live CPU/RAM widgets in taskbar
- Theme presets (Cyberpunk, Forest, Sunset, Mono)

## Future (P2)
- Multi-user mode with cloud-sync of settings/notes (would need backend)
- File drag-drop between Files and Notes
- Iframe sandbox bypass via backend proxy for blocked sites
