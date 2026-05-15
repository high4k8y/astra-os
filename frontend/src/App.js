import React, { useCallback, useState } from "react";
import "@/App.css";
import "./os/os.css";

import { SettingsProvider, useSettings } from "./os/SettingsContext";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AuthGate from "./auth/AuthGate";

import BootLoader from "./os/BootLoader";
import Desktop from "./os/Desktop";
import Window from "./os/Window";
import Taskbar from "./os/Taskbar";

import Browser from "./os/apps/Browser";
import Settings from "./os/apps/Settings";
import Notes from "./os/apps/Notes";
import Terminal from "./os/apps/Terminal";
import Files from "./os/apps/Files";
import Calculator from "./os/apps/Calculator";
import Chat from "./os/apps/Chat";

const APP_META = {
  Browser:    { title: "Browser",    w: 920, h: 580, comp: Browser },
  Chat:       { title: "Chat",       w: 760, h: 520, comp: Chat },
  Settings:   { title: "Settings",   w: 580, h: 580, comp: Settings },
  Notes:      { title: "Notes",      w: 580, h: 460, comp: Notes },
  Terminal:   { title: "Terminal",   w: 660, h: 420, comp: Terminal },
  Files:      { title: "Files",      w: 600, h: 420, comp: Files },
  Calculator: { title: "Calculator", w: 320, h: 460, comp: Calculator },
};

function spawnPos(n) {
  return { x: 200 + (n % 6) * 28, y: 70 + (n % 6) * 24 };
}

function Shell() {
  const { settings } = useSettings();
  const [windows, setWindows] = useState([]);
  const [zTop, setZTop] = useState(100);
  const [focusedId, setFocusedId] = useState(null);

  const focus = useCallback((id) => {
    setZTop((z) => z + 1);
    setFocusedId(id);
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: zTop + 1, minimized: false } : w)));
  }, [zTop]);

  const launch = useCallback((id) => {
    setWindows((ws) => {
      const existing = ws.find((w) => w.id === id);
      if (existing) {
        const z = zTop + 1;
        setZTop(z);
        setFocusedId(id);
        return ws.map((w) => (w.id === id ? { ...w, z, minimized: false } : w));
      }
      const meta = APP_META[id];
      if (!meta) return ws;
      const { x, y } = spawnPos(ws.length);
      const z = zTop + 1;
      setZTop(z);
      setFocusedId(id);
      return [...ws, { id, x, y, w: meta.w, h: meta.h, z, minimized: false }];
    });
  }, [zTop]);

  // Expose launcher for terminal `open <app>` command
  if (typeof window !== "undefined") window.__astraLaunch = launch;

  const close = useCallback((id) => {
    setWindows((ws) => ws.filter((w) => w.id !== id));
    setFocusedId((f) => (f === id ? null : f));
  }, []);

  const minimize = useCallback((id) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
    setFocusedId((f) => (f === id ? null : f));
  }, []);

  const toggleFromDock = useCallback((id) => {
    const w = windows.find((w) => w.id === id);
    if (!w) return;
    if (w.minimized || focusedId !== id) focus(id);
    else minimize(id);
  }, [windows, focusedId, focus, minimize]);

  return (
    <div className={`nx-root ${settings.rgb ? "nx-rgb" : ""}`} data-testid="os-root">
      <BootLoader />
      <Desktop onLaunch={launch} />
      {windows.map((w) => {
        if (w.minimized) return null;
        const meta = APP_META[w.id];
        const Comp = meta.comp;
        return (
          <Window
            key={w.id}
            id={w.id}
            title={meta.title}
            x={w.x} y={w.y} w={w.w} h={w.h} z={w.z}
            onFocus={() => focus(w.id)}
            onClose={() => close(w.id)}
            onMinimize={() => minimize(w.id)}
          >
            <Comp />
          </Window>
        );
      })}
      <Taskbar
        windows={windows}
        focusedId={focusedId}
        onToggle={toggleFromDock}
        onLaunchSettings={() => launch("Settings")}
      />
    </div>
  );
}

function Gate() {
  const { user } = useAuth();
  if (!user) return <AuthGate />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Gate />
      </SettingsProvider>
    </AuthProvider>
  );
}
