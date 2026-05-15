import React, { useState } from "react";
import { useSettings } from "../SettingsContext";
import { useAuth } from "../../auth/AuthContext";
import { LogOut, Code2 } from "lucide-react";

const ACCENT_COLORS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#10b981",
  "#84cc16", "#eab308", "#f97316", "#ef4444",
  "#ec4899", "#a855f7", "#8b5cf6", "#64748b",
];

const WALLPAPERS = [
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=3840",
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=3840",
  "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?q=80&w=3840",
  "https://images.unsplash.com/photo-1462331940025-496de9e46e46?q=80&w=3840",
  "https://images.unsplash.com/photo-1464802680160-9c7f5d5a4a64?q=80&w=3840",
  "https://images.unsplash.com/photo-1506318137071-a8e0661ad6d8?q=80&w=3840",
  "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=3840",
  "https://images.unsplash.com/photo-1419833173245-f59e1b93f9ee?q=80&w=3840",
  "https://images.unsplash.com/photo-1439853949127-fa647821eba0?q=80&w=3840",
  "https://images.unsplash.com/photo-1472552944129-b035e9ea3744?q=80&w=3840",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=3840",
  "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=3840",
  "https://images.unsplash.com/photo-1444080748397-f442aa95c3e5?q=80&w=3840",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=3840",
];

const TABS = [
  { id: "appearance", label: "Appearance" },
  { id: "wallpaper",  label: "Wallpaper" },
  { id: "display",    label: "Display" },
  { id: "account",    label: "Account" },
  { id: "system",     label: "System" },
];

export default function Settings() {
  const { settings, update, reset } = useSettings();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("appearance");

  return (
    <div className="nx-settings" data-testid="app-settings">
      <div className="nx-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nx-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
            data-testid={`set-tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="nx-tab-body">
        {tab === "appearance" && (
          <div data-testid="set-pane-appearance">
            <div className="nx-set-section">
              <div className="nx-set-title">Accent Color</div>
              <div className="nx-color-grid">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`nx-color-opt ${settings.accent === c ? "active" : ""}`}
                    style={{ background: c }}
                    onClick={() => update({ accent: c })}
                    data-testid={`set-accent-${c.replace("#", "")}`}
                    aria-label={`accent ${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="nx-set-section">
              <div className="nx-set-title">Window Effects</div>
              <div className="nx-row">
                <div>
                  <div className="nx-row-label">Blur intensity</div>
                  <div className="nx-row-help">Background blur behind windows.</div>
                </div>
                <div className="nx-slider-wrap">
                  <input
                    type="range" min="0" max="80"
                    value={settings.blur}
                    onChange={(e) => update({ blur: Number(e.target.value) })}
                    className="nx-slider"
                    data-testid="set-blur"
                  />
                  <span className="nx-slider-val">{settings.blur}px</span>
                </div>
              </div>
              <div className="nx-row">
                <div>
                  <div className="nx-row-label">Transparency</div>
                  <div className="nx-row-help">Opacity of window surfaces.</div>
                </div>
                <div className="nx-slider-wrap">
                  <input
                    type="range" min="0.35" max="1" step="0.05"
                    value={settings.transparency}
                    onChange={(e) => update({ transparency: Number(e.target.value) })}
                    className="nx-slider"
                    data-testid="set-transparency"
                  />
                  <span className="nx-slider-val">{Math.round(settings.transparency * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "wallpaper" && (
          <div data-testid="set-pane-wallpaper">
            <div className="nx-set-section">
              <div className="nx-set-title">Choose Wallpaper</div>
              <div className="nx-wall-grid">
                {WALLPAPERS.map((w, i) => {
                  const full = w + "&auto=format&fit=crop";
                  const active = settings.wallpaper === full;
                  return (
                    <button
                      key={w}
                      className={`nx-wall-item ${active ? "active" : ""}`}
                      style={{ backgroundImage: `url('${w}&auto=format&fit=crop&w=600')` }}
                      onClick={() => update({ wallpaper: full })}
                      data-testid={`set-wallpaper-${i}`}
                      aria-label={`wallpaper ${i + 1}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "display" && (
          <div data-testid="set-pane-display">
            <div className="nx-set-section">
              <div className="nx-set-title">Typography</div>
              <div className="nx-row">
                <div>
                  <div className="nx-row-label">Base font size</div>
                  <div className="nx-row-help">Affects content across all apps.</div>
                </div>
                <div className="nx-slider-wrap">
                  <input
                    type="range" min="11" max="20"
                    value={settings.fontSize}
                    onChange={(e) => update({ fontSize: Number(e.target.value) })}
                    className="nx-slider"
                    data-testid="set-fontsize"
                  />
                  <span className="nx-slider-val">{settings.fontSize}px</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "account" && (
          <div data-testid="set-pane-account">
            <div className="nx-set-section">
              <div className="nx-set-title">Signed in as</div>
              <div className="nx-row">
                <div>
                  <div className="nx-row-label" data-testid="set-account-username">{user?.username || "—"}</div>
                  <div className="nx-row-help">Account ID: {user?.id?.slice(0, 8) || "—"}…</div>
                </div>
                {user?.is_dev && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#86efac", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }} data-testid="set-account-devbadge">
                    <Code2 size={12} strokeWidth={2} /> developer
                  </div>
                )}
              </div>
              <div className="nx-row">
                <div>
                  <div className="nx-row-label">Created</div>
                  <div className="nx-row-help">When you joined Astra OS.</div>
                </div>
                <div className="nx-slider-val" style={{ minWidth: 120 }}>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                </div>
              </div>
            </div>
            <div className="nx-set-section">
              <div className="nx-set-title">Session</div>
              <div className="nx-btn-row">
                <button className="nx-btn" onClick={logout} data-testid="set-logout">
                  <LogOut size={13} strokeWidth={1.7} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Sign out
                </button>
              </div>
              <div className="nx-row-help" style={{ marginTop: 8 }}>
                Sessions persist on this device for 30 days.
              </div>
            </div>
          </div>
        )}

        {tab === "system" && (
          <div data-testid="set-pane-system">
            <div className="nx-set-section">
              <div className="nx-set-title">Effects</div>
              <div className="nx-row">
                <div>
                  <div className="nx-row-label">RGB mode</div>
                  <div className="nx-row-help">Animated chroma border on windows.</div>
                </div>
                <button
                  className={`nx-toggle ${settings.rgb ? "on" : ""}`}
                  onClick={() => update({ rgb: !settings.rgb })}
                  data-testid="set-rgb-toggle"
                  aria-label="toggle rgb"
                />
              </div>
              <div className="nx-row">
                <div>
                  <div className="nx-row-label">24-hour clock</div>
                  <div className="nx-row-help">Display military time (e.g. 14:30) instead of 2:30 PM.</div>
                </div>
                <button
                  className={`nx-toggle ${settings.clock24 ? "on" : ""}`}
                  onClick={() => update({ clock24: !settings.clock24 })}
                  data-testid="set-clock24-toggle"
                  aria-label="toggle 24h clock"
                />
              </div>
            </div>

            <div className="nx-set-section">
              <div className="nx-set-title">Cursor style</div>
              <div className="ax-pickrow" data-testid="set-cursor-list">
                {[
                  { id: "system", label: "Normal" },
                  { id: "dot", label: "Dot + Ring" },
                  { id: "ring", label: "Ring" },
                  { id: "minimal", label: "Minimal" },
                  { id: "crosshair", label: "Crosshair" },
                  { id: "glow", label: "Glow" },
                ].map((c) => (
                  <button
                    key={c.id}
                    className={`ax-pick ${settings.cursor === c.id ? "active" : ""}`}
                    onClick={() => update({ cursor: c.id })}
                    data-testid={`set-cursor-${c.id}`}
                  >
                    <span className={`ax-pick-preview ax-pick-cursor-${c.id}`} aria-hidden />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="nx-set-section">
              <div className="nx-set-title">Animated background</div>
              <div className="ax-pickrow" data-testid="set-animbg-list">
                {[
                  { id: "none",   label: "Off" },
                  { id: "aurora", label: "Aurora" },
                  { id: "stars",  label: "Stars" },
                  { id: "grid",   label: "Grid" },
                  { id: "waves",  label: "Waves" },
                ].map((b) => (
                  <button
                    key={b.id}
                    className={`ax-pick ${settings.animatedBg === b.id ? "active" : ""}`}
                    onClick={() => update({ animatedBg: b.id })}
                    data-testid={`set-animbg-${b.id}`}
                  >
                    <span className={`ax-pick-preview ax-pick-bg-${b.id}`} aria-hidden />
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
              <div className="nx-row-help" style={{ marginTop: 6 }}>
                Renders behind your wallpaper. Set to Off to disable.
              </div>
            </div>
            <div className="nx-set-section">
              <div className="nx-set-title">Power</div>
              <div className="nx-btn-row">
                <button className="nx-btn" onClick={reset} data-testid="set-reset">Reset Defaults</button>
                <button className="nx-btn primary" onClick={() => window.location.reload()} data-testid="set-reboot">Reboot</button>
              </div>
            </div>
            <div className="nx-set-section">
              <div className="nx-set-title">About</div>
              <div className="nx-row">
                <div className="nx-row-label">Astra OS</div>
                <div className="nx-slider-val">v1.0</div>
              </div>
              <div className="nx-row">
                <div className="nx-row-label">Build</div>
                <div className="nx-slider-val">stable · 2026.01</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
