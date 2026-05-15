import React, { useEffect, useState } from "react";
import { DESKTOP_ICONS } from "./Desktop";
import AstraLogo from "./AstraLogo";
import { LogOut, Code2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useSettings } from "./SettingsContext";

const ICON_BY_ID = Object.fromEntries(DESKTOP_ICONS.map((i) => [i.id, i.Icon]));

export default function Taskbar({ windows, onToggle, focusedId, onLaunchSettings }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: !settings.clock24,
      }));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [settings.clock24]);

  return (
    <div className="nx-taskbar" data-testid="taskbar">
      <div className="nx-tb-logo" data-testid="taskbar-logo" onClick={onLaunchSettings} title="Settings" role="button">
        <AstraLogo size={22} glow={false} />
        <span style={{ marginLeft: 4 }}>ASTRA</span>
      </div>

      {user?.is_dev && (
        <div className="nx-tb-dev" data-testid="taskbar-devchip">
          <Code2 size={11} strokeWidth={2} /> DEV
        </div>
      )}

      {windows.length > 0 && <div className="nx-tb-divider" />}
      <div className="nx-dock" data-testid="taskbar-dock">
        {windows.map((w) => {
          const Icon = ICON_BY_ID[w.id];
          const isWebapp = w.id && typeof w.id === "string" && w.id.startsWith("app:");
          return (
            <button
              key={w.id}
              className={`nx-dock-btn ${focusedId === w.id && !w.minimized ? "active" : ""}`}
              onClick={() => onToggle(w.id)}
              title={isWebapp && w.app ? w.app.name : w.id}
              data-testid={`dock-btn-${w.id}`}
            >
              {isWebapp && w.app ? (
                <span className="ax-installed-icon" style={{ background: w.app.color, fontSize: 11, width: 22, height: 22 }}>{w.app.emoji}</span>
              ) : Icon ? <Icon size={16} strokeWidth={1.6} /> : "•"}
            </button>
          );
        })}
      </div>
      <div className="nx-tb-spacer" />

      {user && (
        <>
          <div className="nx-tb-divider" />
          <div className="nx-tb-user" data-testid="taskbar-user" title={user.username}>
            <span className="nx-tb-avatar">{(user.username || "?").slice(0, 1).toUpperCase()}</span>
            <span className="nx-tb-username">{user.username}</span>
          </div>
          <button className="nx-tb-logout" onClick={logout} title="Sign out" data-testid="taskbar-logout">
            <LogOut size={14} strokeWidth={1.7} />
          </button>
        </>
      )}

      <div className="nx-tb-divider" />
      <div className="nx-clock" data-testid="taskbar-clock">{clock}</div>
    </div>
  );
}
