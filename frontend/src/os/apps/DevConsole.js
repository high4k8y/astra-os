import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Users, ShieldAlert, FileText, Filter, Megaphone, Power, Send, Rocket, Trash2, RefreshCw } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

const TABS = [
  { id: "users",    label: "Users",     Icon: Users },
  { id: "events",   label: "Events",    Icon: FileText },
  { id: "filter",   label: "Filter",    Icon: Filter },
  { id: "broadcast",label: "Broadcast", Icon: Megaphone },
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
      setMsg(`✓ ${label} — ok${r?.data?.kicked ? ` (kicked ${r.data.kicked})` : r?.data?.sent ? ` (delivered ${r.data.sent})` : ""}`);
      await load();
    } catch (e) {
      setMsg(`✗ ${label}: ${e.response?.data?.detail || e.message}`);
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
      setTimeout(() => setMsg(""), 3500);
    }
  };

  const ban = (u) => {
    const r = window.prompt(`Ban "${u.username}" — reason (optional):`, "");
    if (r === null) return;
    action("Ban", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/ban`, data: { reason: r } }), u.id);
  };
  const unban = (u) => action("Unban", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/unban` }), u.id);
  const kick = (u) => action("Kick", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/kick` }), u.id);
  const notify = (u) => {
    const title = window.prompt(`Notify "${u.username}" — title:`, "Hi there");
    if (!title) return;
    const body = window.prompt(`Notify "${u.username}" — body:`, "Sent from the Dev Console.");
    if (!body) return;
    action("Notify", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/notify`, data: { title, body } }), u.id);
  };
  const launch = (u) => {
    const app = window.prompt(`Launch which app on "${u.username}"? (Browser, Notes, Snake, Chat, Settings, Files, Calculator, Terminal, Clock, Paint, Store)`, "Notes");
    if (!app) return;
    action("Launch", () => api({ method: "POST", url: `${API}/admin/users/${u.id}/launch`, data: { app } }), u.id);
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
        {users.map((u) => (
          <div className={`ax-dev-row ${u.is_banned ? "banned" : ""}`} key={u.id} data-testid={`dev-user-${u.username}`}>
            <span className={`ax-dev-status ${u.online ? "online" : "off"}`} title={u.online ? "online" : "offline"} />
            <div className="ax-dev-userinfo">
              <div>
                <span className="ax-dev-username">{u.username}</span>
                {u.is_dev && <span className="ax-chat-devchip" style={{ marginLeft: 6 }}>dev</span>}
                {u.is_banned && <span className="ax-dev-banchip">banned</span>}
              </div>
              <div className="ax-dev-id">{u.id.slice(0, 8)} · joined {new Date(u.created_at).toLocaleDateString()}</div>
            </div>
            <div className="ax-dev-actions">
              <button onClick={() => notify(u)} disabled={!u.online || !!busy[u.id]} title="Send a popup notification" data-testid={`dev-notify-${u.username}`}>
                <Send size={11} strokeWidth={1.8} /> Notify
              </button>
              <button onClick={() => launch(u)} disabled={!u.online || !!busy[u.id]} title="Force-launch an app on this user's screen" data-testid={`dev-launch-${u.username}`}>
                <Rocket size={11} strokeWidth={1.8} /> Launch
              </button>
              <button onClick={() => kick(u)} disabled={!u.online || !!busy[u.id]} title="Disconnect" data-testid={`dev-kick-${u.username}`}>
                <Power size={11} strokeWidth={1.8} /> Kick
              </button>
              {u.is_banned ? (
                <button className="ok" onClick={() => unban(u)} disabled={!!busy[u.id]} data-testid={`dev-unban-${u.username}`}>
                  Unban
                </button>
              ) : (
                <button className="danger" onClick={() => ban(u)} disabled={u.is_dev || !!busy[u.id]} title={u.is_dev ? "Cannot ban a developer" : "Ban this user"} data-testid={`dev-ban-${u.username}`}>
                  <ShieldAlert size={11} strokeWidth={1.8} /> Ban
                </button>
              )}
            </div>
          </div>
        ))}
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
