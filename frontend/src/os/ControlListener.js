import React, { useEffect, useRef, useState } from "react";
import { X, Bell } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

/**
 * Global toast layer that listens to WS control messages from the Dev Console:
 *   - "notify"  → shows a popup
 *   - "launch"  → opens an app on the receiver's screen via window.__astraLaunch
 *   - "kicked"  → forces sign-out
 * Connection is shared with the Chat app — both connect to /api/ws/chat with the same token.
 * This component opens its own listener WS so toasts work even if Chat isn't open.
 */
function wsUrl(token) {
  const base = process.env.REACT_APP_BACKEND_URL || "";
  const proto = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "");
  return `${proto}://${host}/api/ws/chat?token=${encodeURIComponent(token)}`;
}

let toastId = 0;

export default function ControlListener() {
  const { token, logout } = useAuth();
  const [toasts, setToasts] = useState([]);
  const wsRef = useRef(null);
  const reconnectRef = useRef(0);

  useEffect(() => {
    if (!token) return;
    let closed = false;

    const open = () => {
      const ws = new WebSocket(wsUrl(token));
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
  }, [token, logout]);

  if (!toasts.length) return null;
  return (
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
  );
}
