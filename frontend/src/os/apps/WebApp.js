import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw, ExternalLink, X } from "lucide-react";

const PROXY = `${process.env.REACT_APP_BACKEND_URL || ""}/api/proxy?url=`;

/**
 * WebApp — a minimal browser-like wrapper for installed third-party apps.
 * The app object: { id, name, url, color, emoji }
 *
 * Note: many real apps (Discord, YouTube, ChatGPT, Spotify) use cookies, JS,
 * and login flows the proxy can't replay. The UI surfaces an "Open in real
 * browser" CTA so users can always reach the working app.
 */
export default function WebApp({ app, onClose }) {
  const [history, setHistory] = useState([app.url]);
  const [hIdx, setHIdx] = useState(0);
  const [src, setSrc] = useState(PROXY + encodeURIComponent(app.url));
  const [loading, setLoading] = useState(true);
  const [loadStarted, setLoadStarted] = useState(Date.now());
  const [showWarn, setShowWarn] = useState(false);
  const iframeRef = useRef(null);

  // If iframe doesn't load within 6s, show "open in real browser" warning
  useEffect(() => {
    setShowWarn(false);
    if (!loading) return;
    const id = setTimeout(() => { if (loading) setShowWarn(true); }, 6000);
    return () => clearTimeout(id);
  }, [loading, loadStarted]);

  const navigate = (url) => {
    setHistory((h) => {
      const trimmed = h.slice(0, hIdx + 1);
      trimmed.push(url);
      return trimmed;
    });
    setHIdx((i) => i + 1);
    setSrc(PROXY + encodeURIComponent(url));
    setLoading(true);
    setLoadStarted(Date.now());
  };

  const back = () => {
    if (hIdx <= 0) return;
    const ni = hIdx - 1;
    setHIdx(ni);
    setSrc(PROXY + encodeURIComponent(history[ni]));
    setLoading(true);
  };
  const forward = () => {
    if (hIdx >= history.length - 1) return;
    const ni = hIdx + 1;
    setHIdx(ni);
    setSrc(PROXY + encodeURIComponent(history[ni]));
    setLoading(true);
  };
  const reload = () => {
    setLoading(true);
    const cur = src;
    setSrc("");
    setTimeout(() => setSrc(cur), 30);
  };

  useEffect(() => {
    // Re-navigate to home if app prop changes (e.g., re-launched)
    setHistory([app.url]);
    setHIdx(0);
    setSrc(PROXY + encodeURIComponent(app.url));
    setLoading(true);
  }, [app.url]);

  const currentUrl = history[hIdx];

  return (
    <div className="ax-webapp" data-testid={`webapp-${app.id}`}>
      <div className="ax-webapp-bar" style={{ borderTop: `2px solid ${app.color}` }}>
        <span className="ax-webapp-icon" style={{ background: app.color }} aria-hidden>{app.emoji}</span>
        <span className="ax-webapp-name">{app.name}</span>
        <div className="ax-webapp-tools">
          <button onClick={back} disabled={hIdx <= 0} title="Back" data-testid={`webapp-${app.id}-back`}>
            <ArrowLeft size={14} strokeWidth={1.7} />
          </button>
          <button onClick={forward} disabled={hIdx >= history.length - 1} title="Forward" data-testid={`webapp-${app.id}-forward`}>
            <ArrowRight size={14} strokeWidth={1.7} />
          </button>
          <button onClick={reload} title="Reload" data-testid={`webapp-${app.id}-reload`}>
            <RotateCw size={14} strokeWidth={1.7} />
          </button>
          <a href={currentUrl} target="_blank" rel="noopener noreferrer" title="Open in real browser" data-testid={`webapp-${app.id}-extopen`}>
            <ExternalLink size={14} strokeWidth={1.7} />
          </a>
        </div>
      </div>
      <div className="ax-webapp-body">
        {src ? (
          <iframe
            ref={iframeRef}
            src={src}
            title={app.name}
            onLoad={() => setLoading(false)}
            data-testid={`webapp-${app.id}-iframe`}
          />
        ) : null}
        {loading && <div className="ax-webapp-loading">loading {app.name}…</div>}
        {showWarn && (
          <div className="ax-webapp-fallback" data-testid={`webapp-${app.id}-fallback`}>
            <div className="ax-webapp-fallback-card">
              <div className="ax-webapp-fallback-icon" style={{ background: app.color }}>{app.emoji}</div>
              <div className="ax-webapp-fallback-title">{app.name} won't embed</div>
              <div className="ax-webapp-fallback-text">
                {app.name} blocks embedding or needs a real browser session (cookies, login, JS APIs).
                Open it in your real browser — your settings here are preserved.
              </div>
              <a
                className="ax-webapp-fallback-btn"
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`webapp-${app.id}-openreal`}
              >Open {app.name} in your browser</a>
              <button className="ax-webapp-fallback-link" onClick={() => setShowWarn(false)}>Keep waiting</button>
            </div>
          </div>
        )}
      </div>
      <div className="ax-webapp-status">
        <span className={`dot ${loading ? "loading" : ""}`} />
        <span>{loading ? "loading…" : "ready"}</span>
        <span className="ax-webapp-url">{currentUrl}</span>
      </div>
    </div>
  );
}
