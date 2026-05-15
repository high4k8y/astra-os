import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Send, Code2, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function wsUrl(token) {
  const base = process.env.REACT_APP_BACKEND_URL || "";
  const proto = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "");
  return `${proto}://${host}/api/ws/chat?token=${encodeURIComponent(token)}`;
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function Chat() {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("connecting"); // connecting | online | offline
  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const reconnectRef = useRef(0);

  // history
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/chat/history?limit=80`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancel) setMessages(data || []);
      } catch (e) { /* ignore */ }
    })();
    return () => { cancel = true; };
  }, [token]);

  // websocket
  useEffect(() => {
    if (!token) return;
    let closed = false;

    const open = () => {
      const ws = new WebSocket(wsUrl(token));
      wsRef.current = ws;

      ws.onopen = () => { setStatus("online"); reconnectRef.current = 0; };
      ws.onmessage = (ev) => {
        try {
          const obj = JSON.parse(ev.data);
          if (obj.type === "message") {
            setMessages((m) => [...m, obj.data]);
          } else if (obj.type === "online") {
            setOnline(obj.users || []);
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        setStatus("offline");
        if (closed) return;
        const delay = Math.min(1000 * 2 ** reconnectRef.current, 8000);
        reconnectRef.current += 1;
        setTimeout(() => { if (!closed) open(); }, delay);
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };

    open();
    return () => {
      closed = true;
      try { wsRef.current && wsRef.current.close(); } catch {}
    };
  }, [token]);

  // autoscroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text }));
    setInput("");
  };

  return (
    <div className="ax-chat" data-testid="app-chat">
      <aside className="ax-chat-side">
        <div className="ax-chat-side-head">
          {status === "online"
            ? <Wifi size={13} strokeWidth={1.7} style={{ color: "#22c55e" }} />
            : <WifiOff size={13} strokeWidth={1.7} style={{ color: "#fca5a5" }} />}
          <span data-testid="chat-status">{status}</span>
          <span className="ax-chat-side-count">{online.length}</span>
        </div>
        <div className="ax-chat-roster" data-testid="chat-online-list">
          {online.length === 0 && <div className="ax-chat-empty">no one else here</div>}
          {online.map((u) => (
            <div
              key={u.id}
              className={`ax-chat-roster-item ${u.id === user?.id ? "me" : ""}`}
              data-testid={`chat-user-${u.username}`}
            >
              <span className="ax-chat-dot" />
              <span className="ax-chat-name">{u.username}</span>
              {u.is_dev && <span className="ax-chat-devchip" title="developer"><Code2 size={9} strokeWidth={2} />dev</span>}
              {u.id === user?.id && <span className="ax-chat-you">you</span>}
            </div>
          ))}
        </div>
      </aside>

      <main className="ax-chat-main">
        <div className="ax-chat-log" ref={scrollRef} data-testid="chat-log">
          {messages.length === 0 && (
            <div className="ax-chat-blank">No messages yet — say hi 👋</div>
          )}
          {messages.map((m) => {
            if (m.kind === "system") {
              return (
                <div key={m.id} className="ax-chat-sys" data-testid={`chat-msg-${m.id}`}>
                  · {m.text} · <span>{fmtTime(m.ts)}</span>
                </div>
              );
            }
            const mine = m.username === user?.username;
            return (
              <div
                key={m.id}
                className={`ax-chat-msg ${mine ? "mine" : ""}`}
                data-testid={`chat-msg-${m.id}`}
              >
                <div className="ax-chat-msg-head">
                  <span className="ax-chat-msg-name">{m.username}</span>
                  {m.is_dev && <span className="ax-chat-devchip"><Code2 size={9} strokeWidth={2} />dev</span>}
                  <span className="ax-chat-msg-time">{fmtTime(m.ts)}</span>
                </div>
                <div className="ax-chat-msg-text">{m.text}</div>
              </div>
            );
          })}
        </div>
        <form className="ax-chat-compose" onSubmit={send}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={status === "online" ? "Type a message…" : "Reconnecting…"}
            disabled={status !== "online"}
            maxLength={500}
            data-testid="chat-input"
            spellCheck="false"
          />
          <button type="submit" disabled={status !== "online" || !input.trim()} data-testid="chat-send">
            <Send size={14} strokeWidth={1.8} />
          </button>
        </form>
      </main>
    </div>
  );
}
