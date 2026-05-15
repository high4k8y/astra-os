import React, { useEffect, useRef, useState } from "react";
import { Globe, Settings as SettingsIcon, FileText, TerminalSquare, Folder, Calculator as CalcIcon, MessageSquare, Clock as ClockIcon, Gamepad2, Brush, Store as StoreIcon, ShieldAlert } from "lucide-react";
import { loadInstalled } from "./installedApps";
import { useAuth } from "../auth/AuthContext";

const ICON_STORAGE = "astra-icon-positions";

export const BUILTIN_ICONS = [
  { id: "Browser",    label: "BROWSER",   Icon: Globe },
  { id: "Store",      label: "STORE",     Icon: StoreIcon },
  { id: "Chat",       label: "CHAT",      Icon: MessageSquare },
  { id: "Settings",   label: "SETTINGS",  Icon: SettingsIcon },
  { id: "Notes",      label: "NOTES",     Icon: FileText },
  { id: "Terminal",   label: "TERMINAL",  Icon: TerminalSquare },
  { id: "Files",      label: "FILES",     Icon: Folder },
  { id: "Calculator", label: "CALC",      Icon: CalcIcon },
  { id: "Clock",      label: "CLOCK",     Icon: ClockIcon },
  { id: "Snake",      label: "SNAKE",     Icon: Gamepad2 },
  { id: "Paint",      label: "PAINT",     Icon: Brush },
  { id: "DevConsole", label: "DEV SYS",   Icon: ShieldAlert },
];

// Backwards-compat for Taskbar (ICON_BY_ID map needs DevConsole too)
export const DESKTOP_ICONS = BUILTIN_ICONS;

function defaultPositionFor(index) {
  const COL = 100;
  const ROW = 98;
  const c = Math.floor(index / 6);
  const r = index % 6;
  return { x: 32 + c * COL, y: 32 + r * ROW };
}

function loadPositions() {
  try {
    const raw = localStorage.getItem(ICON_STORAGE);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function savePositions(p) {
  try { localStorage.setItem(ICON_STORAGE, JSON.stringify(p)); } catch (e) { /* ignore */ }
}

function DraggableIcon({ id, label, position, onMove, onLaunch, children, testid }) {
  const drag = useRef(null);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: position.x, oy: position.y, moved: false };
    const move = (ev) => {
      if (!drag.current) return;
      const dx = ev.clientX - drag.current.sx;
      const dy = ev.clientY - drag.current.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      const nx = Math.max(8, Math.min(window.innerWidth - 96, drag.current.ox + dx));
      const ny = Math.max(8, Math.min(window.innerHeight - 110, drag.current.oy + dy));
      onMove(id, { x: nx, y: ny });
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      className="nx-icon"
      style={{ left: position.x, top: position.y }}
      onMouseDown={onMouseDown}
      onDoubleClick={() => onLaunch(id)}
      data-testid={testid}
    >
      <div className="nx-icon-box">{children}</div>
      <div className="nx-icon-label">{label}</div>
    </div>
  );
}

export default function Desktop({ onLaunch }) {
  const [positions, setPositions] = useState(loadPositions);
  const [apps, setApps] = useState(loadInstalled);
  const { user } = useAuth();

  useEffect(() => {
    const refresh = () => setApps(loadInstalled());
    window.addEventListener("astra-apps-updated", refresh);
    return () => window.removeEventListener("astra-apps-updated", refresh);
  }, []);

  useEffect(() => { savePositions(positions); }, [positions]);

  const move = (id, pos) => setPositions((p) => ({ ...p, [id]: pos }));

  const builtins = [...BUILTIN_ICONS];
  if (!user?.is_dev) {
    // Hide DevConsole icon from regular users
    const idx = builtins.findIndex((b) => b.id === "DevConsole");
    if (idx >= 0) builtins.splice(idx, 1);
  }

  const all = [
    ...builtins.map((b, i) => ({ kind: "builtin", id: b.id, label: b.label, defIdx: i, render: () => <b.Icon size={22} strokeWidth={1.5} /> })),
    ...apps.map((a, i) => ({
      kind: "app",
      id: `app:${a.id}`,
      label: a.name.toUpperCase().slice(0, 9),
      defIdx: builtins.length + i,
      app: a,
      render: () => (
        <div className="ax-installed-icon" style={{ background: a.color }}>{a.emoji}</div>
      ),
    })),
  ];

  return (
    <div className="nx-desktop" data-testid="desktop">
      {all.map((it) => {
        const pos = positions[it.id] || defaultPositionFor(it.defIdx);
        const tid = it.kind === "builtin" ? `desktop-icon-${it.id}` : `desktop-app-${it.app.id}`;
        return (
          <DraggableIcon
            key={it.id}
            id={it.id}
            label={it.label}
            position={pos}
            onMove={move}
            onLaunch={onLaunch}
            testid={tid}
          >
            {it.render()}
          </DraggableIcon>
        );
      })}
    </div>
  );
}
