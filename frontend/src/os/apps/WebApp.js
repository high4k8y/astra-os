import React, { useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, Zap, ArrowLeft } from "lucide-react";

const PROXY = `${process.env.REACT_APP_BACKEND_URL || ""}/api/proxy?url=`;

/**
 * WebApp — chrome-less container for installed third-party apps.
 *
 * Loading strategies (per-app `mode`):
 *   "proxy"    — route through /api/proxy (default; rewrites assets, fetch, XHR, srcset, CSS url())
 *   "embed"    — service-specific embed URL (e.g. YouTube nocookie / Spotify embed)
 *   "direct"   — straight iframe to the URL (only works for sites without X-Frame-Options)
 *   "fallback" — show "stay in Astra" card immediately (no iframe attempt)
 *
 * Nothing here ever takes the user outside Astra OS — no `target="_blank"`,
 * no `Open in real browser` links. Failed loads stay inside the OS.
 */
export default function WebApp({ app }) {
  const declared = app.mode || "proxy";
  const [mode, setMode] = useState(declared);
  const [src, setSrc] = useState("");
  const [loading, setLoading] = useState(true);
  const [showFallback, setShowFallback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const triedProxyRef = useRef(false);
  const triedDirectRef = useRef(false);

  const targetSrc = useMemo(() => {
    if (mode === "embed" && app.embed) return app.embed;
    if (mode === "direct") return app.url;
    if (mode === "proxy") return PROXY + encodeURIComponent(app.url);
    return "";
  }, [mode, app.url, app.embed]);

  useEffect(() => {
    triedProxyRef.current = false;
    triedDirectRef.current = false;
    setMode(declared);
    setShowFallback(false);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, [app.id, app.url, declared]);

  useEffect(() => {
    if (mode === "fallback") {
      setShowFallback(true);
      setLoading(false);
      setSrc("");
    } else {
      setSrc(targetSrc);
    }
  }, [mode, targetSrc]);

  // Escalate on timeout: proxy → direct → fallback, direct → proxy → fallback
  useEffect(() => {
    if (!loading || mode === "fallback") return;
    const ms = mode === "direct" ? 5000 : 12000;
    const id = setTimeout(() => {
      if (!loading) return;
      if (mode === "proxy" && !triedDirectRef.current) {
        triedDirectRef.current = true;
        setMode("direct");
        setLoading(true);
        return;
      }
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
    triedDirectRef.current = false;
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

  // "Back" button: tells the iframe to history.back()
  const goBack = () => {
    try {
      const iframe = document.querySelector(`[data-testid='webapp-${app.id}-iframe']`);
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.history.back();
      }
    } catch { /* cross-origin or other; ignore */ }
  };

  return (
    <div className="ax-webapp ax-webapp-chromeless" data-testid={`webapp-${app.id}`}>
      <div className="ax-webapp-body">
        {src && !showFallback ? (
          <iframe
            key={reloadKey + ":" + mode}
            src={src}
            title={app.name}
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-presentation allow-modals allow-downloads allow-storage-access-by-user-activation"
            allow="autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share; storage-access"
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
              <div className="ax-webapp-fallback-title">{app.name} didn't connect</div>
              <div className="ax-webapp-fallback-text">
                {app.name} couldn't be reached through the proxy or direct iframe — it likely
                challenges automated requests (Cloudflare, CAPTCHA) or requires a real OAuth flow.
                Stay in Astra and try again, or switch loading mode.
              </div>
              <div className="ax-webapp-fallback-actions">
                <button className="ax-webapp-fallback-btn" onClick={reload} data-testid={`webapp-${app.id}-retry`}>
                  <RotateCw size={12} strokeWidth={2} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  Try again
                </button>
                <button className="ax-webapp-fallback-link" onClick={toggleMode} data-testid={`webapp-${app.id}-fallback-toggle`}>
                  <Zap size={11} strokeWidth={1.9} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Try {mode === "proxy" ? "direct" : "proxy"} mode
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating overlay (visible on hover) — purely internal controls, no external links */}
        {!showFallback && (
          <div className="ax-webapp-overlay">
            <button onClick={goBack} title="Back" data-testid={`webapp-${app.id}-back`}>
              <ArrowLeft size={13} strokeWidth={1.8} />
            </button>
            <button onClick={reload} title="Reload" data-testid={`webapp-${app.id}-reload`}>
              <RotateCw size={13} strokeWidth={1.8} />
            </button>
            {mode !== "embed" && (
              <button onClick={toggleMode} title={`Switch to ${mode === "direct" ? "proxy" : "direct"} mode`} data-testid={`webapp-${app.id}-togglemode`}>
                <Zap size={13} strokeWidth={1.8} style={{ opacity: mode === "direct" ? 1 : 0.6 }} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
