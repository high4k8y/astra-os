import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, RotateCw, Zap } from "lucide-react";

const PROXY = `${process.env.REACT_APP_BACKEND_URL || ""}/api/proxy?url=`;

/**
 * WebApp — chrome-less container for installed third-party apps.
 *
 * Loading strategies (per-app `mode`):
 *   "proxy"    — route through /api/proxy (default; rewrites assets, fetch, XHR, srcset, CSS url())
 *   "embed"    — service-specific embed URL (e.g. YouTube nocookie / Spotify embed)
 *   "direct"   — straight iframe to the URL (only works for sites without X-Frame-Options)
 *   "fallback" — show "open in real browser" card immediately
 *
 * If the chosen mode takes too long, escalate: direct → proxy → fallback, proxy → fallback.
 * The hover overlay exposes Reload + Direct/Proxy toggle + Open-in-real-browser.
 */
export default function WebApp({ app }) {
  const declared = app.mode || "proxy";
  const [mode, setMode] = useState(declared);
  const [src, setSrc] = useState("");
  const [loading, setLoading] = useState(true);
  const [showFallback, setShowFallback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const triedProxyRef = useRef(false);

  // Compute the iframe src for the active mode
  const targetSrc = useMemo(() => {
    if (mode === "embed" && app.embed) return app.embed;
    if (mode === "direct") return app.url;
    if (mode === "proxy") return PROXY + encodeURIComponent(app.url);
    return "";
  }, [mode, app.url, app.embed]);

  // Reset when the app or declared mode changes
  useEffect(() => {
    triedProxyRef.current = false;
    setMode(declared);
    setShowFallback(false);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, [app.id, app.url, declared]);

  // Sync src to active target / show fallback for fallback-mode apps
  useEffect(() => {
    if (mode === "fallback") {
      setShowFallback(true);
      setLoading(false);
      setSrc("");
    } else {
      setSrc(targetSrc);
    }
  }, [mode, targetSrc]);

  // Escalate on timeout (direct → proxy → fallback; proxy → fallback)
  useEffect(() => {
    if (!loading || mode === "fallback") return;
    const ms = mode === "direct" ? 5000 : 12000;
    const id = setTimeout(() => {
      if (!loading) return;
      if (mode === "direct" && !triedProxyRef.current) {
        triedProxyRef.current = true;
        setMode("proxy");
        setLoading(true);
        return;
      }
      setShowFallback(true);
    }, ms);
    return () => clearTimeout(id);
  }, [loading, mode, reloadKey]);

  const reload = () => {
    triedProxyRef.current = false;
    setShowFallback(false);
    setLoading(true);
    setMode(declared);
    setReloadKey((k) => k + 1);
  };

  const toggleMode = () => {
    setShowFallback(false);
    setLoading(true);
    setMode((m) => (m === "direct" ? "proxy" : "direct"));
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="ax-webapp ax-webapp-chromeless" data-testid={`webapp-${app.id}`}>
      <div className="ax-webapp-body">
        {src && !showFallback ? (
          <iframe
            key={reloadKey + ":" + mode}
            src={src}
            title={app.name}
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals allow-downloads"
            allow="autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            referrerPolicy="no-referrer"
            onLoad={() => setLoading(false)}
            data-testid={`webapp-${app.id}-iframe`}
          />
        ) : null}

        {loading && !showFallback && (
          <div className="ax-webapp-loading" data-testid={`webapp-${app.id}-loading`}>
            <div className="ax-webapp-loading-spinner" />
            <div>connecting to <b>{app.name}</b>… <span className="ax-webapp-loading-mode">via {mode}</span></div>
          </div>
        )}

        {showFallback && (
          <div className="ax-webapp-fallback" data-testid={`webapp-${app.id}-fallback`}>
            <div className="ax-webapp-fallback-card">
              <div className="ax-webapp-fallback-icon" style={{ background: app.color }}>{app.emoji}</div>
              <div className="ax-webapp-fallback-title">{app.name}</div>
              <div className="ax-webapp-fallback-text">
                {app.name} won't load through the proxy — it likely requires a real login session,
                browser cookies, or WebSocket connections that the proxy can't replay.
                Open it in your real browser to use it normally.
              </div>
              <a
                className="ax-webapp-fallback-btn"
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`webapp-${app.id}-openreal`}
              >Open {app.name} →</a>
              <button className="ax-webapp-fallback-link" onClick={reload} data-testid={`webapp-${app.id}-retry`}>
                <RotateCw size={11} strokeWidth={1.9} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Floating overlay (visible on hover) */}
        {!showFallback && (
          <div className="ax-webapp-overlay">
            <button onClick={reload} title="Reload" data-testid={`webapp-${app.id}-reload`}>
              <RotateCw size={13} strokeWidth={1.8} />
            </button>
            {mode !== "embed" && (
              <button onClick={toggleMode} title={`Switch to ${mode === "direct" ? "proxy" : "direct"} mode`} data-testid={`webapp-${app.id}-togglemode`}>
                <Zap size={13} strokeWidth={1.8} style={{ opacity: mode === "direct" ? 1 : 0.6 }} />
              </button>
            )}
            <a href={app.url} target="_blank" rel="noopener noreferrer" title="Open in real browser" data-testid={`webapp-${app.id}-extopen`}>
              <ExternalLink size={13} strokeWidth={1.8} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
