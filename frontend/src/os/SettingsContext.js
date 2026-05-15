import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "astra-os-settings";

const DEFAULTS = {
  accent: "#6366f1",
  accentRgb: "99, 102, 241",
  wallpaper: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=3840&auto=format&fit=crop",
  blur: 36,
  transparency: 0.72,
  fontSize: 14,
  rgb: false,
  cursor: "dot",          // "none" | "dot" | "crosshair" | "glow" | "minimal"
  clock24: false,         // false = 12h, true = 24h (military)
  animatedBg: "none",     // "none" | "aurora" | "stars" | "grid" | "waves"
};

const SettingsCtx = createContext(null);

function hexToRgb(hex) {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m || m.length < 3) return "99, 102, 241";
  return `${parseInt(m[0], 16)}, ${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}`;
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // migrate legacy boolean cursor → string
        if (typeof parsed.cursor === "boolean") parsed.cursor = parsed.cursor ? "dot" : "none";
        return { ...DEFAULTS, ...parsed };
      }
    } catch (e) { /* ignore */ }
    return DEFAULTS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    const r = document.documentElement.style;
    r.setProperty("--ax-accent", settings.accent);
    r.setProperty("--ax-accent-rgb", settings.accentRgb || hexToRgb(settings.accent));
    r.setProperty("--ax-blur", `${settings.blur}px`);
    r.setProperty("--ax-glass-alpha", String(settings.transparency));
    r.setProperty("--ax-font", `${settings.fontSize}px`);
    r.setProperty("--ax-wall", `url('${settings.wallpaper}')`);
  }, [settings]);

  const update = (patch) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      if (patch.accent) next.accentRgb = hexToRgb(patch.accent);
      return next;
    });
  };

  const reset = () => setSettings(DEFAULTS);

  return (
    <SettingsCtx.Provider value={{ settings, update, reset }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export const useSettings = () => useContext(SettingsCtx);
