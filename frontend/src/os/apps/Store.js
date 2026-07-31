import React, { useEffect, useState } from "react";
import { Search, Plus, Check, Trash2, Globe } from "lucide-react";
import { CATALOG, loadInstalled, installFromCatalog, installCustom, uninstall, isInstalled } from "../installedApps";

const TABS = [
  { id: "featured", label: "Featured" },
  { id: "custom",   label: "Install URL" },
  { id: "installed", label: "Installed" },
];

export default function Store() {
  const [tab, setTab] = useState("featured");
  const [installed, setInstalled] = useState(loadInstalled);
  const [q, setQ] = useState("");
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customEmoji, setCustomEmoji] = useState("◇");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const refresh = () => setInstalled(loadInstalled());
    window.addEventListener("astra-apps-updated", refresh);
    return () => window.removeEventListener("astra-apps-updated", refresh);
  }, []);

  const filtered = CATALOG.filter(
    (c) => !q || (c.name + c.desc + c.url).toLowerCase().includes(q.toLowerCase())
  );

  const onInstall = (entry) => {
    installFromCatalog(entry);
    setFeedback(`✓ Installed ${entry.name} — check your desktop.`);
    setTimeout(() => setFeedback(""), 2500);
  };

  const onCustom = (e) => {
    e.preventDefault();
    if (!customName.trim() || !customUrl.trim()) return;
    const entry = installCustom({ name: customName.trim(), url: customUrl.trim(), emoji: customEmoji || "◇" });
    setFeedback(`✓ Installed ${entry.name}.`);
    setCustomName(""); setCustomUrl(""); setCustomEmoji("◇");
    setTimeout(() => setFeedback(""), 2500);
  };

  const onUninstall = (id) => {
    if (!window.confirm("Uninstall this app?")) return;
    uninstall(id);
  };

  return (
    <div className="ax-store" data-testid="app-store">
      <div className="nx-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nx-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
            data-testid={`store-tab-${t.id}`}
          >{t.label}</button>
        ))}
      </div>

      {feedback && <div className="ax-store-feedback" data-testid="store-feedback">{feedback}</div>}

      <div className="nx-tab-body" style={{ padding: 14 }}>
        {tab === "featured" && (
          <div data-testid="store-featured">
            <div className="ax-store-search">
              <Search size={14} strokeWidth={1.7} />
              <input
                placeholder="Search apps…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="store-search"
                spellCheck="false"
              />
            </div>
            <div className="ax-store-grid">
              {filtered.map((c) => {
                const isBuiltin = c.builtin;
                const installedHere = isBuiltin ? false : isInstalled(c.id);
                const canLaunch = isBuiltin ? typeof window !== "undefined" && !!window.__astraLaunch : true;
                return (
                  <div className="ax-store-card" key={c.id} data-testid={`store-card-${c.id}`}>
                    <div className="ax-store-icon" style={{ background: c.color }}>{c.emoji}</div>
                    <div className="ax-store-meta">
                      <div className="ax-store-name">{c.name}</div>
                      <div className="ax-store-desc">{c.desc}</div>
                      <div className="ax-store-url">{c.displayUrl || c.url.replace(/^https?:\/\//, "")}</div>
                    </div>
                    <button
                      className={`ax-store-install ${installedHere ? "installed" : ""} ${isBuiltin ? "launch" : ""}`}
                      onClick={() => isBuiltin ? window.__astraLaunch?.(c.launchId || c.id) : (!installedHere && onInstall(c))}
                      disabled={installedHere || (isBuiltin && !canLaunch)}
                      data-testid={`store-install-${c.id}`}
                    >
                      {isBuiltin ? <><Check size={12} strokeWidth={2.4} /> Launch</> : installedHere ? <><Check size={12} strokeWidth={2.4} /> Installed</> : <><Plus size={12} strokeWidth={2.4} /> Install</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "custom" && (
          <div data-testid="store-custom">
            <div className="nx-set-title">Install any website as an app</div>
            <form className="ax-store-form" onSubmit={onCustom}>
              <label className="auth-field">
                <span>App name</span>
                <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="My App" required maxLength={30} data-testid="store-custom-name" />
              </label>
              <label className="auth-field">
                <span>URL</span>
                <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://example.com" required data-testid="store-custom-url" />
              </label>
              <label className="auth-field">
                <span>Icon (emoji or 1 char)</span>
                <input value={customEmoji} onChange={(e) => setCustomEmoji(e.target.value.slice(0, 2))} placeholder="◇" maxLength={2} data-testid="store-custom-emoji" />
              </label>
              <button type="submit" className="auth-submit" data-testid="store-custom-install">
                <Plus size={14} strokeWidth={2} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Install
              </button>
            </form>
            <div className="nx-row-help" style={{ marginTop: 12 }}>
              Heads up: many sites block embedding (login flows, payments, anything requiring cookies).
              Read-mostly sites work best — Wikipedia, news sites, docs, search engines.
            </div>
          </div>
        )}

        {tab === "installed" && (
          <div data-testid="store-installed">
            {installed.length === 0 ? (
              <div className="ax-files-empty" style={{ marginTop: 6 }}>
                <Globe size={20} strokeWidth={1.4} />
                <span>Nothing installed yet — head to Featured or Install URL.</span>
              </div>
            ) : (
              <div className="ax-store-grid">
                {installed.map((a) => (
                  <div className="ax-store-card" key={a.id} data-testid={`store-installed-${a.id}`}>
                    <div className="ax-store-icon" style={{ background: a.color }}>{a.emoji}</div>
                    <div className="ax-store-meta">
                      <div className="ax-store-name">{a.name}</div>
                      <div className="ax-store-desc">Installed {new Date(a.installedAt).toLocaleDateString()}</div>
                      <div className="ax-store-url">{a.url.replace(/^https?:\/\//, "").slice(0, 50)}</div>
                    </div>
                    <button className="ax-store-install danger" onClick={() => onUninstall(a.id)} data-testid={`store-uninstall-${a.id}`}>
                      <Trash2 size={12} strokeWidth={2.2} /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
