import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Home as HomeIcon, Search, Download, Bookmark, Star } from "lucide-react";
import { downloadViaProxy } from "../downloads";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const PROXY = `${BACKEND}/api/proxy?url=`;
const BM_KEY = "astra-bookmarks";

const QUICK_LINKS = [
  { label: "DuckDuckGo", url: "https://duckduckgo.com" },
  { label: "Wikipedia",  url: "https://wikipedia.org" },
  { label: "Hacker News", url: "https://news.ycombinator.com" },
  { label: "GitHub",     url: "https://github.com" },
  { label: "MDN",        url: "https://developer.mozilla.org" },
  { label: "example.com", url: "https://example.com" },
];

function resolveTarget(raw) {
  const v = (raw || "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[^\s]+\.[^\s]+$/.test(v)) return "https://" + v;
  // Use DuckDuckGo HTML-lite — works perfectly through the proxy (no JS needed)
  return "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(v);
}

function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem(BM_KEY) || "[]"); } catch { return []; }
}
function saveBookmarks(list) {
  try { localStorage.setItem(BM_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) { /* ignore */ }
}

export default function Browser() {
  const [history, setHistory] = useState([]);    // navigation stack (URLs)
  const [hIdx, setHIdx] = useState(-1);          // current index in stack
  const [url, setUrl] = useState("");            // address bar text
  const [iframeSrc, setIframeSrc] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("proxy");
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState("");
  const iframeRef = useRef(null);

  const showHome = hIdx === -1;
  const currentUrl = hIdx >= 0 ? history[hIdx] : "";

  useEffect(() => { saveBookmarks(bookmarks); }, [bookmarks]);
  useEffect(() => { setUrl(currentUrl); }, [currentUrl]);

  // Listen for admin "navigate" command (set on window by ControlListener)
  useEffect(() => {
    const check = () => {
      if (typeof window !== "undefined" && window.__astraNavigate) {
        const target = window.__astraNavigate;
        window.__astraNavigate = null;
        goTo(target);
      }
    };
    check();
    const id = setInterval(check, 400);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (raw, { pushHistory = true } = {}) => {
    const target = resolveTarget(raw);
    if (!target) return;
    if (pushHistory) {
      setHistory((h) => {
        const trimmed = h.slice(0, hIdx + 1);
        trimmed.push(target);
        return trimmed;
      });
      setHIdx((i) => i + 1);
    }
    setIframeSrc(mode === "proxy" ? PROXY + encodeURIComponent(target) : target);
    setLoading(true);
  };

  const back = () => {
    if (hIdx <= 0) return;
    const ni = hIdx - 1;
    setHIdx(ni);
    setIframeSrc(mode === "proxy" ? PROXY + encodeURIComponent(history[ni]) : history[ni]);
    setLoading(true);
  };
  const forward = () => {
    if (hIdx >= history.length - 1) return;
    const ni = hIdx + 1;
    setHIdx(ni);
    setIframeSrc(mode === "proxy" ? PROXY + encodeURIComponent(history[ni]) : history[ni]);
    setLoading(true);
  };
  const goHome = () => { setHIdx(-1); setIframeSrc(""); setUrl(""); setLoading(false); };
  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === "proxy" ? "direct" : "proxy";
      if (currentUrl) {
        setIframeSrc(next === "proxy" ? PROXY + encodeURIComponent(currentUrl) : currentUrl);
        setLoading(true);
      }
      return next;
    });
  };

  const reload = () => {
    if (showHome) return;
    setLoading(true);
    const src = iframeSrc;
    setIframeSrc("");
    setTimeout(() => setIframeSrc(src), 30);
  };

  const isBookmarked = bookmarks.some((b) => b.url === currentUrl);
  const toggleBookmark = () => {
    if (!currentUrl) return;
    setBookmarks((bs) => {
      if (bs.some((b) => b.url === currentUrl)) return bs.filter((b) => b.url !== currentUrl);
      let label = currentUrl;
      try { label = new URL(currentUrl).hostname.replace(/^www\./, ""); } catch (e) { /* ignore */ }
      return [{ url: currentUrl, label }, ...bs];
    });
  };

  const doDownload = async () => {
    const target = currentUrl || resolveTarget(url);
    if (!target) return;
    setDownloading(true);
    setDownloadMsg("");
    try {
      const r = await downloadViaProxy(target);
      setDownloadMsg(`Saved ${r.name}`);
    } catch (e) {
      setDownloadMsg(`Download failed: ${e.message}`);
    } finally {
      setDownloading(false);
      setTimeout(() => setDownloadMsg(""), 3500);
    }
  };

  return (
    <div className="nx-browser" data-testid="app-browser">
      <div className="nx-browser-tools">
        <button onClick={back} disabled={hIdx <= 0} data-testid="br-back" title="Back">
          <ArrowLeft size={15} strokeWidth={1.8} />
        </button>
        <button onClick={forward} disabled={hIdx >= history.length - 1} data-testid="br-forward" title="Forward">
          <ArrowRight size={15} strokeWidth={1.8} />
        </button>
        <button onClick={reload} disabled={showHome} data-testid="br-reload" title="Reload">
          <RotateCw size={15} strokeWidth={1.8} />
        </button>
        <button onClick={goHome} data-testid="br-home" title="Home">
          <HomeIcon size={15} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={toggleMode}
          data-testid="br-toggle-mode"
          title={`Switch to ${mode === "proxy" ? "direct" : "proxy"} mode`}
          style={{ minWidth: 90, fontSize: 12 }}
        >
          {mode === "proxy" ? "Proxy" : "Direct"}
        </button>
        <input
          className="nx-browser-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && goTo(url)}
          placeholder="Search the web or enter a URL"
          data-testid="br-url-input"
          spellCheck="false"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button onClick={() => goTo(url)} data-testid="br-go" title="Go" style={{ padding: "6px 12px", fontSize: 12, color: "var(--ax-text)" }}>
          Go
        </button>
        <button
          onClick={toggleBookmark}
          disabled={showHome}
          data-testid="br-bookmark"
          title={isBookmarked ? "Remove bookmark" : "Add bookmark"}
          style={{ color: isBookmarked ? "#fbbf24" : undefined }}
        >
          {isBookmarked ? <Star size={15} strokeWidth={1.8} fill="currentColor" /> : <Bookmark size={15} strokeWidth={1.8} />}
        </button>
        <button onClick={doDownload} disabled={downloading || (showHome && !url.trim())} data-testid="br-download" title="Download this page">
          <Download size={15} strokeWidth={1.8} />
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
              onKeyDown={(e) => e.key === "Enter" && goTo(e.target.value)}
              data-testid="br-home-search"
              spellCheck="false"
              autoCapitalize="off"
              autoCorrect="off"
            />
            <button
              className="nx-home-go"
              onClick={(e) => {
                const inp = e.currentTarget.parentElement.querySelector("input");
                goTo(inp.value);
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
                onClick={() => goTo(q.url)}
                data-testid={`br-chip-${q.label}`}
              >{q.label}</button>
            ))}
          </div>
          {bookmarks.length > 0 && (
            <div style={{ marginTop: 22, width: "100%", maxWidth: 540 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--ax-text-mute)", marginBottom: 8, fontFamily: "var(--ax-mono)" }}>Bookmarks</div>
              <div className="nx-home-chips" style={{ marginTop: 0 }}>
                {bookmarks.map((b) => (
                  <button key={b.url} className="nx-chip" onClick={() => goTo(b.url)} data-testid={`br-bm-${b.label}`}>
                    <Star size={11} strokeWidth={2} style={{ marginRight: 4, color: "#fbbf24" }} />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="nx-home-hint">routed via secure proxy · downloads land in Files → Downloads</div>
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
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUrl}</span>
          {downloadMsg && <span style={{ color: downloadMsg.startsWith("Saved") ? "#86efac" : "#fda4af" }} data-testid="br-download-msg">{downloadMsg}</span>}
        </div>
      )}
    </div>
  );
}
