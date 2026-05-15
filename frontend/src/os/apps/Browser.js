import React, { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Home as HomeIcon, Search } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const PROXY = `${BACKEND}/api/proxy?url=`;

const QUICK_LINKS = [
  { label: "DuckDuckGo", url: "https://duckduckgo.com" },
  { label: "Wikipedia", url: "https://wikipedia.org" },
  { label: "Hacker News", url: "https://news.ycombinator.com" },
  { label: "GitHub", url: "https://github.com" },
  { label: "MDN", url: "https://developer.mozilla.org" },
  { label: "example.com", url: "https://example.com" },
];

function resolveTarget(raw) {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  // domain-like? (has a dot, no spaces)
  if (/^[^\s]+\.[^\s]+$/.test(v)) return "https://" + v;
  // otherwise: search
  return "https://duckduckgo.com/?q=" + encodeURIComponent(v) + "&kp=-2";
}

export default function Browser() {
  const [showHome, setShowHome] = useState(true);
  const [url, setUrl] = useState("");
  const [iframeSrc, setIframeSrc] = useState("");
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef(null);

  const navigate = (raw) => {
    const target = resolveTarget(raw ?? url);
    if (!target) return;
    setUrl(target);
    setIframeSrc(PROXY + encodeURIComponent(target));
    setShowHome(false);
    setLoading(true);
  };

  const goHome = () => {
    setShowHome(true);
    setIframeSrc("");
    setUrl("");
    setLoading(false);
  };

  const reload = () => {
    if (iframeRef.current) {
      setLoading(true);
      // re-trigger
      const src = iframeSrc;
      setIframeSrc("");
      setTimeout(() => setIframeSrc(src), 20);
    }
  };

  return (
    <div className="nx-browser" data-testid="app-browser">
      <div className="nx-browser-tools">
        <button onClick={() => iframeRef.current && iframeRef.current.contentWindow.history.back()} data-testid="br-back" title="Back">
          <ArrowLeft size={15} strokeWidth={1.8} />
        </button>
        <button onClick={() => iframeRef.current && iframeRef.current.contentWindow.history.forward()} data-testid="br-forward" title="Forward">
          <ArrowRight size={15} strokeWidth={1.8} />
        </button>
        <button onClick={reload} data-testid="br-reload" title="Reload">
          <RotateCw size={15} strokeWidth={1.8} />
        </button>
        <button onClick={goHome} data-testid="br-home" title="Home">
          <HomeIcon size={15} strokeWidth={1.8} />
        </button>
        <input
          className="nx-browser-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate()}
          placeholder="Search the web or enter a URL"
          data-testid="br-url-input"
          spellCheck="false"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button onClick={() => navigate()} data-testid="br-go" title="Go" style={{ padding: "6px 12px", fontSize: 12, color: "var(--ax-text)" }}>
          Go
        </button>
      </div>

      {showHome ? (
        <div className="nx-home" data-testid="br-home-screen">
          <div className="nx-home-logo">astra<span>.</span></div>
          <div className="nx-home-searchwrap">
            <Search size={16} strokeWidth={1.8} style={{ color: "var(--ax-text-mute)" }} />
            <input
              className="nx-home-search"
              placeholder="Search the web or enter a URL"
              onKeyDown={(e) => e.key === "Enter" && navigate(e.target.value)}
              data-testid="br-home-search"
              spellCheck="false"
              autoCapitalize="off"
              autoCorrect="off"
            />
            <button
              className="nx-home-go"
              onClick={(e) => {
                const inp = e.currentTarget.parentElement.querySelector("input");
                navigate(inp.value);
              }}
              data-testid="br-home-go"
            >
              Search
            </button>
          </div>
          <div className="nx-home-chips">
            {QUICK_LINKS.map((q) => (
              <button
                key={q.url}
                className="nx-chip"
                onClick={() => navigate(q.url)}
                data-testid={`br-chip-${q.label}`}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="nx-home-hint">routed via secure proxy · no cookies stored</div>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="browser"
          onLoad={() => setLoading(false)}
          data-testid="br-iframe"
        />
      )}

      {!showHome && (
        <div className="nx-browser-status">
          <span className={`dot ${loading ? "loading" : ""}`} />
          <span data-testid="br-status">{loading ? "loading…" : "ready"}</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
        </div>
      )}
    </div>
  );
}
