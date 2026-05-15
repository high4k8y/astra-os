import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw, ExternalLink, X } from "lucide-react";

const PROXY = `${process.env.REACT_APP_BACKEND_URL || ""}/api/proxy?url=`;

/**
 * WebApp — a minimal browser-like wrapper for installed third-party apps.
 * The app object: { id, name, url, color, emoji }
 */
export default function WebApp({ app, onClose }) {
  const [history, setHistory] = useState([app.url]);
  const [hIdx, setHIdx] = useState(0);
  const [src, setSrc] = useState(PROXY + encodeURIComponent(app.url));
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);

  const navigate = (url) => {
    setHistory((h) => {
      const trimmed = h.slice(0, hIdx + 1);
      trimmed.push(url);
      return trimmed;
    });
    setHIdx((i) => i + 1);
    setSrc(PROXY + encodeURIComponent(url));
    setLoading(true);
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
      </div>
      <div className="ax-webapp-status">
        <span className={`dot ${loading ? "loading" : ""}`} />
        <span>{loading ? "loading…" : "ready"}</span>
        <span className="ax-webapp-url">{currentUrl}</span>
      </div>
    </div>
  );
}
