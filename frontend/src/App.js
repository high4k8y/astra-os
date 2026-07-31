import React, { useCallback, useEffect, useState } from "react";
import "@/App.css";
import "./os/os.css";

import { SettingsProvider, useSettings } from "./os/SettingsContext";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AuthGate from "./auth/AuthGate";

import BootLoader from "./os/BootLoader";
import Desktop from "./os/Desktop";
import Window from "./os/Window";
import Taskbar from "./os/Taskbar";
import CustomCursor from "./os/CustomCursor";
import AnimatedBackground from "./os/AnimatedBackground";

import Browser from "./os/apps/Browser";
import Settings from "./os/apps/Settings";
import Notes from "./os/apps/Notes";
import Terminal from "./os/apps/Terminal";
import Files from "./os/apps/Files";
import Calculator from "./os/apps/Calculator";
import Chat from "./os/apps/Chat";
import Clock from "./os/apps/Clock";
import Snake from "./os/apps/Snake";
import Paint from "./os/apps/Paint";
import Store from "./os/apps/Store";
import ProfilePicker from "./os/apps/ProfilePicker";
import WebApp from "./os/apps/WebApp";
import DevConsole from "./os/apps/DevConsole";
import ControlListener from "./os/ControlListener";
import { loadInstalled } from "./os/installedApps";

const APP_META = {
  Browser:    { title: "Browser",    w: 920, h: 580, comp: Browser },
  Store:      { title: "App Store",  w: 720, h: 560, comp: Store },
  Profile:    { title: "Profile Picker", w: 760, h: 520, comp: ProfilePicker },
  Chat:       { title: "Chat",       w: 760, h: 520, comp: Chat },
  Settings:   { title: "Settings",   w: 580, h: 580, comp: Settings },
  Notes:      { title: "Notes",      w: 580, h: 460, comp: Notes },
  Terminal:   { title: "Terminal",   w: 660, h: 420, comp: Terminal },
  Files:      { title: "Files",      w: 600, h: 420, comp: Files },
  Calculator: { title: "Calculator", w: 320, h: 460, comp: Calculator },
  Clock:      { title: "Clock",      w: 460, h: 380, comp: Clock },
  Snake:      { title: "Snake",      w: 540, h: 540, comp: Snake },
  Paint:      { title: "Paint",      w: 720, h: 520, comp: Paint },
  DevConsole: { title: "Dev Console",w: 880, h: 560, comp: DevConsole },
};

function spawnPos(n) {
  return { x: 220 + (n % 6) * 28, y: 70 + (n % 6) * 24 };
}

function Shell() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [windows, setWindows] = useState([]);
  const [zTop, setZTop] = useState(100);
  const [focusedId, setFocusedId] = useState(null);
  const [disabledApps, setDisabledApps] = useState([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const UPDATE_NOTICE_KEY = "astra_update_notice_v1";
  const UPDATE_NOTICE_TEXT = "New Astra OS update: admin app disable controls, chat timeout management, role permissions, window resizing, and a first-time update notice on login.";

  useEffect(() => {
    if (!user) return;
    try {
      const seen = localStorage.getItem(UPDATE_NOTICE_KEY);
      if (!seen) {
        setShowUpdateModal(true);
      }
    } catch (e) {
      setShowUpdateModal(false);
    }
  }, [user]);

  useEffect(() => {
    const loadDisabled = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || ""}/api/apps/disabled`);
        if (!res.ok) return;
        const data = await res.json();
        setDisabledApps(Array.isArray(data.apps) ? data.apps : []);
      } catch (e) {
        console.warn("Failed to load disabled apps", e);
      }
    };
    loadDisabled();
  }, []);

  const focus = useCallback((id) => {
    setZTop((z) => z + 1);
    setFocusedId(id);
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: zTop + 1, minimized: false } : w)));
  }, [zTop]);

  const launch = useCallback((id) => {
    if (disabledApps.includes(id) && !user?.is_dev) {
      window.alert(`${id} is disabled by an administrator.`);
      return;
    }
    setWindows((ws) => {
      const existing = ws.find((w) => w.id === id);
      if (existing) {
        const z = zTop + 1;
        setZTop(z);
        setFocusedId(id);
        return ws.map((w) => (w.id === id ? { ...w, z, minimized: false } : w));
      }
      // built-in app?
      const meta = APP_META[id];
      if (meta) {
        const { x, y } = spawnPos(ws.length);
        const z = zTop + 1;
        setZTop(z);
        setFocusedId(id);
        return [...ws, { id, kind: "builtin", x, y, w: meta.w, h: meta.h, z, minimized: false }];
      }
      // installed app? id format "app:<appId>"
      if (id.startsWith("app:")) {
        const appId = id.slice(4);
        const app = loadInstalled().find((a) => a.id === appId);
        if (!app) return ws;
        const { x, y } = spawnPos(ws.length);
        const z = zTop + 1;
        setZTop(z);
        setFocusedId(id);
        return [...ws, { id, kind: "webapp", app, x, y, w: 1000, h: 620, z, minimized: false }];
      }
      return ws;
    });
  }, [disabledApps, user?.is_dev, zTop]);

  if (typeof window !== "undefined") window.__astraLaunch = launch;

  const closeAll = useCallback(() => {
    setWindows([]);
    setFocusedId(null);
  }, []);
  if (typeof window !== "undefined") window.__astraCloseAll = closeAll;

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
      <AnimatedBackground mode={settings.animatedBg || "none"} />
      <CustomCursor mode={settings.cursor || "dot"} />
      <ControlListener />
      <BootLoader />
      {showUpdateModal && (
        <div className="ax-update-modal">
          <div className="ax-update-card">
            <h2>What's new</h2>
            <p>{UPDATE_NOTICE_TEXT}</p>
            <button className="nx-btn primary" onClick={() => {
              localStorage.setItem(UPDATE_NOTICE_KEY, "1");
              setShowUpdateModal(false);
            }}>
              Got it
            </button>
          </div>
        </div>
      )}
      <Desktop onLaunch={launch} />
      {windows.map((w) => {
        if (w.minimized) return null;
        let title = "App";
        let body = null;
        if (w.kind === "webapp") {
          title = w.app.name;
          body = <WebApp app={w.app} onClose={() => close(w.id)} />;
        } else {
          const meta = APP_META[w.id];
          if (!meta) return null;
          title = meta.title;
          const Comp = meta.comp;
          body = <Comp />;
        }
        return (
          <Window
            key={w.id}
            id={w.id}
            title={title}
            x={w.x} y={w.y} w={w.w} h={w.h} z={w.z}
            onFocus={() => focus(w.id)}
            onClose={() => close(w.id)}
            onMinimize={() => minimize(w.id)}
          >
            {body}
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
