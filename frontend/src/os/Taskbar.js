import React, { useEffect, useState } from "react";
import { DESKTOP_ICONS } from "./Desktop";

const ICON_BY_ID = Object.fromEntries(DESKTOP_ICONS.map((i) => [i.id, i.Icon]));

export default function Taskbar({ windows, onToggle, focusedId }) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="nx-taskbar" data-testid="taskbar">
      <div className="nx-tb-logo" data-testid="taskbar-logo">
        <span className="nx-tb-logo-dot" />
        ASTRA
      </div>
      {windows.length > 0 && <div className="nx-tb-divider" />}
      <div className="nx-dock" data-testid="taskbar-dock">
        {windows.map((w) => {
          const Icon = ICON_BY_ID[w.id];
          return (
            <button
              key={w.id}
              className={`nx-dock-btn ${focusedId === w.id && !w.minimized ? "active" : ""}`}
              onClick={() => onToggle(w.id)}
              title={w.id}
              data-testid={`dock-btn-${w.id}`}
            >
              {Icon ? <Icon size={16} strokeWidth={1.6} /> : "•"}
            </button>
          );
        })}
      </div>
      <div className="nx-tb-spacer" />
      <div className="nx-tb-divider" />
      <div className="nx-clock" data-testid="taskbar-clock">{clock}</div>
    </div>
  );
}
