import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Users, ShieldAlert, FileText, Filter, Megaphone, Power, Send, Rocket,
  Trash2, RefreshCw, Cpu, Link as LinkIcon, X as XIcon, LogOut, MessageSquare, AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

const TABS = [
  { id: "users",     label: "Users",      Icon: Users },
  { id: "chat",      label: "Chat",       Icon: MessageSquare },
  { id: "events",    label: "Events",     Icon: FileText },
  { id: "filter",    label: "Filter",     Icon: Filter },
  { id: "broadcast", label: "Broadcast",  Icon: Megaphone },
];

function fmtTs(iso) {
  try { return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return ""; }
}

function useApi() {
  const { token } = useAuth();
  return useCallback((cfg) => axios({ ...cfg, headers: { Authorization: `Bearer ${token}`, ...(cfg.headers || {}) } }), [token]);
}

export default function DevConsole() {
  const [tab, setTab] = useState("users");
  return (
    <div className="ax-dev" data-testid="app-devconsole">
      <div className="nx-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nx-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
            data-testid={`dev-tab-${t.id}`}
          >
            <t.Icon size={12} strokeWidth={1.8} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="nx-tab-body" style={{ padding: 14 }}>
        {tab === "users" && <UsersPane />}
        {tab === "chat" && <ChatModPane />}
        {tab === "events" && <EventsPane />}
        {tab === "filter" && <FilterPane />}
        {tab === "broadcast" && <BroadcastPane />}
      </div>
    </div>
  );
}

function UsersPane() {
  const api = useApi();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState({});
  const [msg, setMsg] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api({ method: "GET", url: `${API}/admin/users` });
      setUsers(data.users || []);
    } catch (e) {
      setMsg("Failed to load users.");
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const action = async (label, fn, id) => {
    setBusy((b) => ({ ...b, [id]: label }));
    setMsg("");
    try {
      const r = await fn();
      const extras = [];
      if (r?.data?.kicked) extras.push(`kicked ${r.data.kicked}`);
      if (r?.data?.sent) extras.push(`delivered ${r.data.sent}`);
      if (r?.data?.fingerprints_banned) extras.push(`${r.data.fingerprints_banned} device(s) banned`);
      setMsg(`✓ ${label}${extras.length ? ` — ${extras.join(", ")}` : ""}`);
      await load();
    } catch (e) {
      setMsg(`✗ ${label}: ${e.response?.data?.detail || e.message}`);
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
      setTimeout(() => setMsg(""), 4500);
    }
  };

  const ban = (u) => {
    const r = window.prompt(`Ban "${u.username}" — reason (optional):`, "");
    if (r === null) return;
    action("Ban", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/ban`, data: { reason: r } }), u.id);
  };
  const hwban = (u) => {
    if (!window.confirm(`HARDWARE BAN "${u.username}"?\nThis bans every device fingerprint we've seen for them. New accounts from the same machine will be blocked.`)) return;
    const r = window.prompt("Reason (optional):", "");
    if (r === null) return;
    action("HW Ban", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/hwban`, data: { reason: r } }), u.id);
  };
  const hwunban = (u) => action("HW Unban", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/hwunban` }), u.id);
  const unban = (u) => action("Unban", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/unban` }), u.id);
  const kick = (u) => action("Kick", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/kick` }), u.id);
  const closeAll = (u) => {
    if (!window.confirm(`Close every open app on ${u.username}'s screen?`)) return;
    action("Close all", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/closeall` }), u.id);
  };
  const forceLogout = (u) => {
    if (!window.confirm(`Force-sign-out ${u.username}?`)) return;
    action("Force logout", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/logout` }), u.id);
  };
  const notify = (u) => {
    const title = window.prompt(`Notify "${u.username}" — title:`, "Hi there");
    if (!title) return;
    const body = window.prompt(`Notify "${u.username}" — body:`, "Sent from the Dev Console.");
    if (!body) return;
    action("Notify", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/notify`, data: { title, body } }), u.id);
  };
  const takeover = (u) => {
    const title = window.prompt(`Takeover "${u.username}" — banner title:`, "Astra OS — Admin notice");
    if (!title) return;
    const body = window.prompt(`Takeover "${u.username}" — body:`, "Please pay attention.");
    if (!body) return;
    action("Takeover", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/takeover`, data: { title, body, duration_ms: 8000 } }), u.id);
  };
  const launch = (u) => {
    const app = window.prompt(`Launch which app on "${u.username}"? (Browser, Notes, Snake, Chat, Settings, Files, Calculator, Terminal, Clock, Paint, Store)`, "Notes");
    if (!app) return;
    action("Launch", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/launch`, data: { app } }), u.id);
  };
  const navigate = (u) => {
    const url = window.prompt(`Open URL in ${u.username}'s Browser:`, "https://example.com");
    if (!url) return;
    action("Navigate", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/navigate`, data: { url } }), u.id);
  };

  return (
    <div data-testid="dev-pane-users">
      <div className="ax-dev-toolbar">
        <button className="nx-small-btn" onClick={load} disabled={loading} data-testid="dev-refresh">
          <RefreshCw size={11} strokeWidth={1.8} style={{ verticalAlign: "middle", marginRight: 4 }} />
          {loading ? "Loading…" : "Refresh"}
        </button>
        <span className="ax-dev-count">{users.length} users · {users.filter((u) => u.online).length} online</span>
      </div>
      {msg && <div className="ax-dev-msg" data-testid="dev-msg">{msg}</div>}
      <div className="ax-dev-table" data-testid="dev-users-list">
        {users.map((u) => {
          const open = openId === u.id;
          return (
            <div className={`ax-dev-row ${u.is_banned ? "banned" : ""} ${open ? "open" : ""}`} key={u.id} data-testid={`dev-user-${u.username}`}>
              <div className="ax-dev-row-main">
                <span className={`ax-dev-status ${u.online ? "online" : "off"}`} title={u.online ? "online" : "offline"} />
                <div className="ax-dev-userinfo">
                  <div>
                    <span className="ax-dev-username">{u.username}</span>
                    {u.is_dev && <span className="ax-chat-devchip" style={{ marginLeft: 6 }}>dev</span>}
                    {u.is_banned && <span className="ax-dev-banchip">{u.hw_banned ? "hw-banned" : "banned"}</span>}
                  </div>
                  <div className="ax-dev-id">{u.id.slice(0, 8)} · joined {new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                <button
                  className="nx-small-btn"
                  onClick={() => setOpenId(open ? null : u.id)}
                  data-testid={`dev-toggle-${u.username}`}
                >{open ? "Hide controls" : "Controls"}</button>
              </div>
              {open && (
                <div className="ax-dev-actions" data-testid={`dev-actions-${u.username}`}>
                  <button onClick={() => notify(u)} disabled={!u.online || !!busy[u.id]} title="Send a popup notification" data-testid={`dev-notify-${u.username}`}>
                    <Send size={11} strokeWidth={1.8} /> Notify
                  </button>
                  <button onClick={() => takeover(u)} disabled={!u.online || !!busy[u.id]} title="Full-screen takeover banner" data-testid={`dev-takeover-${u.username}`}>
                    <AlertTriangle size={11} strokeWidth={1.8} /> Takeover
                  </button>
                  <button onClick={() => launch(u)} disabled={!u.online || !!busy[u.id]} title="Force-launch an app on this user's screen" data-testid={`dev-launch-${u.username}`}>
                    <Rocket size={11} strokeWidth={1.8} /> Launch app
                  </button>
                  <button onClick={() => navigate(u)} disabled={!u.online || !!busy[u.id]} title="Open a URL in their Browser" data-testid={`dev-navigate-${u.username}`}>
                    <LinkIcon size={11} strokeWidth={1.8} /> Open URL
                  </button>
                  <button onClick={() => closeAll(u)} disabled={!u.online || !!busy[u.id]} title="Close every app on their screen" data-testid={`dev-closeall-${u.username}`}>
                    <XIcon size={11} strokeWidth={1.8} /> Close all
                  </button>
                  <button onClick={() => forceLogout(u)} disabled={!u.online || !!busy[u.id]} title="Sign them out" data-testid={`dev-logout-${u.username}`}>
                    <LogOut size={11} strokeWidth={1.8} /> Force logout
                  </button>
                  <button onClick={() => kick(u)} disabled={!u.online || !!busy[u.id]} title="Disconnect this socket" data-testid={`dev-kick-${u.username}`}>
                    <Power size={11} strokeWidth={1.8} /> Kick
                  </button>
                  {u.is_banned ? (
                    <button className="ok" onClick={() => unban(u)} disabled={!!busy[u.id]} data-testid={`dev-unban-${u.username}`}>
                      Unban
                    </button>
                  ) : (
                    <button className="danger" onClick={() => ban(u)} disabled={u.is_dev || !!busy[u.id]} title={u.is_dev ? "Cannot ban a developer" : "Ban this account"} data-testid={`dev-ban-${u.username}`}>
                      <ShieldAlert size={11} strokeWidth={1.8} /> Ban
                    </button>
                  )}
                  {u.hw_banned ? (
                    <button className="ok" onClick={() => hwunban(u)} disabled={!!busy[u.id]} data-testid={`dev-hwunban-${u.username}`}>
                      <Cpu size={11} strokeWidth={1.8} /> Unban device
                    </button>
                  ) : (
                    <button className="danger" onClick={() => hwban(u)} disabled={u.is_dev || !!busy[u.id]} title={u.is_dev ? "Cannot HW-ban a developer" : "Ban this user AND every device they've signed in from"} data-testid={`dev-hwban-${u.username}`}>
                      <Cpu size={11} strokeWidth={1.8} /> HW ban
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChatModPane() {
  const api = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api({ method: "GET", url: `${API}/admin/chat/recent?limit=200` });
      setItems(data.messages || []);
    } catch (e) { setMsg("Failed to load chat."); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const del = async (m) => {
    if (!window.confirm(`Delete "${m.text.slice(0, 50)}…" by ${m.username || "system"}?`)) return;
    try {
      await api({ method: "DELETE", url: `${API}/admin/chat/${m.id}` });
      setItems((arr) => arr.filter((x) => x.id !== m.id));
      setMsg("✓ Deleted (everyone connected sees it disappear in real time).");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg(`✗ ${e.response?.data?.detail || e.message}`);
    }
  };

  return (
    <div data-testid="dev-pane-chat">
      <div className="ax-dev-toolbar">
        <button className="nx-small-btn" onClick={load} disabled={loading} data-testid="dev-chat-refresh">
          <RefreshCw size={11} strokeWidth={1.8} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Refresh
        </button>
        <span className="ax-dev-count">{items.length} messages (most recent first)</span>
      </div>
      {msg && <div className="ax-dev-msg" data-testid="dev-chat-msg">{msg}</div>}
      <div className="ax-dev-events" data-testid="dev-chat-list">
        {items.map((m) => (
          <div className="ax-dev-event ax-dev-chatrow" key={m.id}>
            <span className={`ax-dev-evtag ax-dev-evtag-${m.kind === "system" ? "system" : "msg"}`}>{m.kind === "system" ? "sys" : "msg"}</span>
            <span className="ax-dev-evuser">{m.username || "—"}{m.is_dev ? " · dev" : ""}</span>
            <span className="ax-dev-evmeta">{m.text}</span>
            <span className="ax-dev-evts">{fmtTs(m.ts)}</span>
            <button
              className="ax-dev-chatdel"
              onClick={() => del(m)}
              title="Delete this message"
              data-testid={`dev-chat-del-${m.id}`}
            ><Trash2 size={11} strokeWidth={1.9} /></button>
          </div>
        ))}
        {items.length === 0 && <div className="ax-files-empty">No messages yet.</div>}
      </div>
    </div>
  );
}

function EventsPane() {
  const api = useApi();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api({ method: "GET", url: `${API}/admin/events?limit=200` });
      setEvents(data.events || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  return (
    <div data-testid="dev-pane-events">
      <div className="ax-dev-toolbar">
        <button className="nx-small-btn" onClick={load} disabled={loading} data-testid="dev-events-refresh">
          <RefreshCw size={11} strokeWidth={1.8} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Refresh
        </button>
        <span className="ax-dev-count">{events.length} entries</span>
      </div>
      <div className="ax-dev-events" data-testid="dev-events-list">
        {events.map((e) => (
          <div className="ax-dev-event" key={e.id}>
            <span className={`ax-dev-evtag ax-dev-evtag-${e.action}`}>{e.action}</span>
            <span className="ax-dev-evuser">{e.username || "—"}</span>
            <span className="ax-dev-evmeta">{Object.keys(e.meta || {}).length ? JSON.stringify(e.meta) : ""}</span>
            <span className="ax-dev-evts">{fmtTs(e.ts)}</span>
          </div>
        ))}
        {events.length === 0 && <div className="ax-files-empty">No events yet.</div>}
      </div>
    </div>
  );
}

function FilterPane() {
  const api = useApi();
  const [text, setText] = useState("");
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api({ method: "GET", url: `${API}/admin/blocked-words` });
      setText((data.words || []).join("\n"));
      setCount((data.words || []).length);
    } catch { /* ignore */ }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const words = text.split(/[\n,]/).map((w) => w.trim()).filter(Boolean);
    try {
      const { data } = await api({ method: "POST", url: `${API}/admin/blocked-words`, data: { words } });
      setCount((data.words || []).length);
      setMsg(`✓ Saved ${data.words.length} blocked words.`);
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg(`✗ ${e.response?.data?.detail || e.message}`);
    }
  };

  return (
    <div data-testid="dev-pane-filter">
      <div className="nx-set-title">Blocked words ({count})</div>
      <div className="nx-row-help" style={{ marginBottom: 10 }}>
        Whole-word filter, case-insensitive. Matched words in chat messages are replaced with asterisks. One word per line (or comma-separated).
      </div>
      <textarea
        className="ax-dev-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="badword&#10;spam&#10;…"
        data-testid="dev-filter-textarea"
        spellCheck="false"
      />
      <div className="ax-dev-toolbar" style={{ marginTop: 8 }}>
        <button className="nx-btn primary" onClick={save} data-testid="dev-filter-save">
          Save
        </button>
        <button className="nx-small-btn" onClick={() => setText("")} data-testid="dev-filter-clear">
          <Trash2 size={11} strokeWidth={1.8} style={{ verticalAlign: "middle", marginRight: 4 }} /> Clear
        </button>
        {msg && <span className="ax-dev-count" data-testid="dev-filter-msg">{msg}</span>}
      </div>
    </div>
  );
}

function BroadcastPane() {
  const api = useApi();
  const [title, setTitle] = useState("Astra OS — System notice");
  const [body, setBody] = useState("Hello everyone!");
  const [msg, setMsg] = useState("");
  const broadcasting = useRef(false);

  const send = async () => {
    if (broadcasting.current) return;
    broadcasting.current = true;
    try {
      await api({ method: "POST", url: `${API}/admin/broadcast`, data: { title, body } });
      setMsg("✓ Broadcast sent to every connected client.");
    } catch (e) {
      setMsg(`✗ ${e.response?.data?.detail || e.message}`);
    } finally {
      broadcasting.current = false;
      setTimeout(() => setMsg(""), 3500);
    }
  };

  return (
    <div data-testid="dev-pane-broadcast">
      <div className="nx-set-title">Broadcast a popup notification to all online clients</div>
      <label className="auth-field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} data-testid="dev-broadcast-title" />
      </label>
      <label className="auth-field" style={{ marginTop: 10 }}>
        <span>Body</span>
        <textarea
          className="ax-dev-textarea"
          style={{ minHeight: 80 }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={400}
          data-testid="dev-broadcast-body"
        />
      </label>
      <div className="ax-dev-toolbar" style={{ marginTop: 10 }}>
        <button className="nx-btn primary" onClick={send} data-testid="dev-broadcast-send">
          <Megaphone size={12} strokeWidth={1.9} style={{ verticalAlign: "middle", marginRight: 6 }} />
          Send broadcast
        </button>
        {msg && <span className="ax-dev-count">{msg}</span>}
      </div>
    </div>
  );
}
