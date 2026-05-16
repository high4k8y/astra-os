import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, RotateCw } from "lucide-react";

const PROXY = `${process.env.REACT_APP_BACKEND_URL || ""}/api/proxy?url=`;

/**
 * WebApp — a chrome-less app container for installed third-party apps.
 *
 * Apps run as if they were native OS apps:
 *   - No browser-like URL bar / back-forward buttons
 *   - Loads use the strategy from the catalog entry (mode):
 *       direct  → iframe straight to the URL
 *       proxy   → iframe via /api/proxy (header-stripping rewriter)
 *       embed   → iframe via service-specific embed URL
 *       fallback→ never iframe; show "open in real browser" card
 *       auto    → try direct first; on timeout switch to proxy; then fallback
 *   - Minimal floating overlay (reload + external link) — only visible on hover.
 */
export default function WebApp({ app, onClose }) {
  const initialMode = app.mode === "auto" || !app.mode ? "auto" : app.mode;
  const [activeMode, setActiveMode] = useState(initialMode);   // direct | proxy | embed | fallback | auto
  const [src, setSrc] = useState("");
  const [loading, setLoading] = useState(true);
  const [showFallback, setShowFallback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef(null);
  const triedRef = useRef({ direct: false, proxy: false });

  const targetSrc = useMemo(() => {
    if (activeMode === "embed" && app.embed) return app.embed;
    if (activeMode === "proxy") return PROXY + encodeURIComponent(app.url);
    if (activeMode === "direct") return app.url;
    return "";
  }, [activeMode, app.url, app.embed]);

  // Reset whenever the app changes
  useEffect(() => {
    triedRef.current = { direct: false, proxy: false };
    setActiveMode(app.mode === "auto" || !app.mode ? "auto" : app.mode);
    setShowFallback(false);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, [app.id, app.url, app.mode]);

  // Resolve "auto" → try direct first
  useEffect(() => {
    if (activeMode === "auto") {
      triedRef.current.direct = true;
      setActiveMode("direct");
    } else if (activeMode === "fallback") {
      setShowFallback(true);
      setLoading(false);
    } else {
      setSrc(targetSrc);
    }
  }, [activeMode, targetSrc]);

  // Loading timeout — if direct fails (CSP block) try proxy then fallback
  useEffect(() => {
    if (!loading || activeMode === "fallback") return;
    const id = setTimeout(() => {
      if (!loading) return;
      // Step down: direct -> proxy -> fallback
      if (activeMode === "direct" && !triedRef.current.proxy) {
        triedRef.current.proxy = true;
        setActiveMode("proxy");
        setLoading(true);
        return;
      }
      if (activeMode === "proxy") {
        setShowFallback(true);
        return;
      }
      // embed/proxy timed out without an alternative path
      setShowFallback(true);
    }, activeMode === "direct" ? 4500 : 9000);
    return () => clearTimeout(id);
  }, [loading, activeMode, reloadKey]);

  const reload = () => {
    triedRef.current = { direct: false, proxy: false };
    setShowFallback(false);
    setLoading(true);
    setActiveMode(app.mode === "auto" || !app.mode ? "auto" : app.mode);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="ax-webapp ax-webapp-chromeless" data-testid={`webapp-${app.id}`}>
      <div className="ax-webapp-body">
        {src && !showFallback ? (
          <iframe
            key={reloadKey + ":" + activeMode}
            ref={iframeRef}
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
            <div>connecting to <b>{app.name}</b>…</div>
          </div>
        )}

        {showFallback && (
          <div className="ax-webapp-fallback" data-testid={`webapp-${app.id}-fallback`}>
            <div className="ax-webapp-fallback-card">
              <div className="ax-webapp-fallback-icon" style={{ background: app.color }}>{app.emoji}</div>
              <div className="ax-webapp-fallback-title">{app.name}</div>
              <div className="ax-webapp-fallback-text">
                {app.name} can't run inside Astra OS because it blocks embedding (cookies, login, JS APIs).
                Open it in your real browser — your Astra session keeps running here.
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
            <a href={app.url} target="_blank" rel="noopener noreferrer" title="Open in real browser" data-testid={`webapp-${app.id}-extopen`}>
              <ExternalLink size={13} strokeWidth={1.8} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
