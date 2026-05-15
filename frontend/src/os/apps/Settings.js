import React, { useState } from "react";
import { useSettings } from "../SettingsContext";

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
];

const TABS = [
  { id: "appearance", label: "Appearance" },
  { id: "wallpaper",  label: "Wallpaper" },
  { id: "display",    label: "Display" },
  { id: "system",     label: "System" },
];

export default function Settings() {
  const { settings, update, reset } = useSettings();
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
