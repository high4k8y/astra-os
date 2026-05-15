import React, { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "astra-icon-positions";

const DEFAULT_POSITIONS = {
  Browser:    { x: 32, y: 32  },
  Chat:       { x: 32, y: 130 },
  Settings:   { x: 32, y: 228 },
  Notes:      { x: 32, y: 326 },
  Terminal:   { x: 32, y: 424 },
  Files:      { x: 32, y: 522 },
  Calculator: { x: 32, y: 620 },
  Clock:      { x: 130, y: 32 },
  Snake:      { x: 130, y: 130 },
  Paint:      { x: 130, y: 228 },
};

function loadPositions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_POSITIONS, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return DEFAULT_POSITIONS;
}

function savePositions(positions) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(positions)); } catch (e) { /* ignore */ }
}

import { Globe, Settings as SettingsIcon, FileText, TerminalSquare, Folder, Calculator as CalcIcon, MessageSquare, Clock as ClockIcon, Gamepad2, Brush } from "lucide-react";

export const DESKTOP_ICONS_LIST = [
  { id: "Browser",    label: "BROWSER",   Icon: Globe },
  { id: "Chat",       label: "CHAT",      Icon: MessageSquare },
  { id: "Settings",   label: "SETTINGS",  Icon: SettingsIcon },
  { id: "Notes",      label: "NOTES",     Icon: FileText },
  { id: "Terminal",   label: "TERMINAL",  Icon: TerminalSquare },
  { id: "Files",      label: "FILES",     Icon: Folder },
  { id: "Calculator", label: "CALC",      Icon: CalcIcon },
  { id: "Clock",      label: "CLOCK",     Icon: ClockIcon },
  { id: "Snake",      label: "SNAKE",     Icon: Gamepad2 },
  { id: "Paint",      label: "PAINT",     Icon: Brush },
];

// Backwards-compat with Taskbar.js
export const DESKTOP_ICONS = DESKTOP_ICONS_LIST;

function DraggableIcon({ icon, position, onMove, onLaunch }) {
  const ref = useRef(null);
  const drag = useRef(null);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag.current = {
      sx: e.clientX, sy: e.clientY,
      ox: position.x, oy: position.y,
      moved: false,
    };
    const move = (ev) => {
      if (!drag.current) return;
      const dx = ev.clientX - drag.current.sx;
      const dy = ev.clientY - drag.current.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      const nx = Math.max(8, Math.min(window.innerWidth - 96, drag.current.ox + dx));
      const ny = Math.max(8, Math.min(window.innerHeight - 110, drag.current.oy + dy));
      onMove(icon.id, { x: nx, y: ny });
    };
    const up = () => {
      const moved = drag.current?.moved;
      drag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (!moved) {
        // Single click — do nothing; double-click handler launches
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      ref={ref}
      className="nx-icon"
      style={{ left: position.x, top: position.y }}
      onMouseDown={onMouseDown}
      onDoubleClick={() => onLaunch(icon.id)}
      data-testid={`desktop-icon-${icon.id}`}
    >
      <div className="nx-icon-box"><icon.Icon size={22} strokeWidth={1.5} /></div>
      <div className="nx-icon-label">{icon.label}</div>
    </div>
  );
}

export default function Desktop({ onLaunch }) {
  const [positions, setPositions] = useState(loadPositions);

  useEffect(() => { savePositions(positions); }, [positions]);

  const move = (id, pos) => setPositions((p) => ({ ...p, [id]: pos }));

  return (
    <div className="nx-desktop" data-testid="desktop">
      {DESKTOP_ICONS_LIST.map((i) => (
        <DraggableIcon
          key={i.id}
          icon={i}
          position={positions[i.id] || DEFAULT_POSITIONS[i.id] || { x: 32, y: 32 }}
          onMove={move}
          onLaunch={onLaunch}
        />
      ))}
    </div>
  );
}
