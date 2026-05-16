import React, { useEffect, useRef, useState } from "react";
import { X, Bell, ShieldAlert } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

/**
 * Global toast layer + remote-control listener.
 * Listens to /api/ws/chat for admin commands:
 *   - notify          → toast
 *   - launch          → open an app
 *   - navigate(url)   → open a URL in the Browser app
 *   - closeall        → close every open window
 *   - force_logout    → sign the user out
 *   - takeover        → fullscreen takeover banner (admin message)
 *   - kicked          → sign-out
 */
function wsUrl(token, fp) {
  const base = process.env.REACT_APP_BACKEND_URL || "";
  const proto = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "");
  const fpPart = fp ? `&fp=${encodeURIComponent(fp)}` : "";
  return `${proto}://${host}/api/ws/chat?token=${encodeURIComponent(token)}${fpPart}`;
}

let toastId = 0;

export default function ControlListener() {
  const { token, logout, fingerprint } = useAuth();
  const [toasts, setToasts] = useState([]);
  const [takeover, setTakeover] = useState(null); // { title, body, from }
  const wsRef = useRef(null);
  const reconnectRef = useRef(0);

  useEffect(() => {
    if (!token) return;
    let closed = false;

    const open = () => {
      const ws = new WebSocket(wsUrl(token, fingerprint));
      wsRef.current = ws;

      ws.onopen = () => { reconnectRef.current = 0; };
      ws.onmessage = (ev) => {
        try {
          const obj = JSON.parse(ev.data);
          if (obj.type === "notify") {
            const id = ++toastId;
            const t = { id, title: obj.title || "Notification", body: obj.body || "", from: obj.from, broadcast: obj.broadcast };
            setToasts((ts) => [...ts, t]);
            setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 8000);
          } else if (obj.type === "launch") {
            if (typeof window !== "undefined" && window.__astraLaunch && obj.app) {
              window.__astraLaunch(obj.app);
              const id = ++toastId;
              setToasts((ts) => [...ts, { id, title: "Astra OS", body: `${obj.from || "An admin"} opened ${obj.app} on your screen.` }]);
              setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6000);
            }
          } else if (obj.type === "navigate") {
            if (typeof window !== "undefined" && obj.url) {
              window.__astraNavigate = obj.url;
              window.__astraLaunch && window.__astraLaunch("Browser");
              const id = ++toastId;
              setToasts((ts) => [...ts, { id, title: "Astra OS", body: `${obj.from || "Admin"} sent you to ${obj.url}` }]);
              setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6000);
            }
          } else if (obj.type === "closeall") {
            if (typeof window !== "undefined" && window.__astraCloseAll) {
              window.__astraCloseAll();
              const id = ++toastId;
              setToasts((ts) => [...ts, { id, title: "Astra OS", body: `${obj.from || "Admin"} closed all your apps.` }]);
              setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5000);
            }
          } else if (obj.type === "force_logout") {
            const id = ++toastId;
            setToasts((ts) => [...ts, { id, title: "Signed out", body: `${obj.from || "Admin"} signed you out.` }]);
            setTimeout(() => { logout(); }, 1200);
          } else if (obj.type === "takeover") {
            setTakeover({ title: obj.title || "Admin message", body: obj.body || "", from: obj.from || "admin" });
            const ms = Math.max(500, Math.min(120000, Number(obj.duration_ms) || 6000));
            setTimeout(() => setTakeover(null), ms);
          } else if (obj.type === "kicked") {
            const id = ++toastId;
            setToasts((ts) => [...ts, { id, title: "Disconnected", body: obj.reason || "You were disconnected by an administrator." }]);
            setTimeout(() => { logout(); }, 1500);
          }
        } catch { /* ignore non-JSON */ }
      };
      ws.onclose = () => {
        if (closed) return;
        const delay = Math.min(1000 * 2 ** reconnectRef.current, 8000);
        reconnectRef.current += 1;
        setTimeout(() => { if (!closed) open(); }, delay);
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };
    open();
    return () => { closed = true; try { wsRef.current && wsRef.current.close(); } catch {} };
  }, [token, logout, fingerprint]);

  return (
    <>
      {toasts.length > 0 && (
        <div className="ax-toast-stack" data-testid="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className="ax-toast" data-testid={`toast-${t.id}`}>
              <div className="ax-toast-icon"><Bell size={14} strokeWidth={1.7} /></div>
              <div className="ax-toast-body">
                <div className="ax-toast-title">{t.title}</div>
                <div className="ax-toast-text">{t.body}</div>
                {t.from && <div className="ax-toast-from">{t.broadcast ? "Broadcast " : ""}from <b>{t.from}</b></div>}
              </div>
              <button
                className="ax-toast-close"
                onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
                aria-label="dismiss"
                data-testid={`toast-close-${t.id}`}
              >
                <X size={13} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
      )}
      {takeover && (
        <div className="ax-takeover" data-testid="takeover-overlay">
          <div className="ax-takeover-card">
            <div className="ax-takeover-icon"><ShieldAlert size={22} strokeWidth={1.7} /></div>
            <div className="ax-takeover-title">{takeover.title}</div>
            <div className="ax-takeover-body">{takeover.body}</div>
            <div className="ax-takeover-from">from <b>{takeover.from}</b></div>
            <button
              className="ax-takeover-close"
              onClick={() => setTakeover(null)}
              data-testid="takeover-dismiss"
            >Dismiss</button>
          </div>
        </div>
      )}
    </>
  );
}
