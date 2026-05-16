import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Send, Rocket, Link as LinkIcon, X as XIcon, LogOut, Power,
  AlertTriangle, ShieldAlert, Cpu, Activity, RefreshCw,
} from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

const APP_OPTIONS = [
  "Browser", "Store", "Chat", "Settings", "Notes", "Terminal",
  "Files", "Calculator", "Clock", "Snake", "Paint",
];

/**
 * RemoteControl — a per-user command panel.
 * Spawned on a developer's own desktop when they hit "Remote Control" on a user row.
 * Props are populated by Dev Console via window.__astraOpenControl(user).
 */
export default function RemoteControl({ target }) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [user, setUser] = useState(target);
  const [navUrl, setNavUrl] = useState("https://example.com");
  const [appName, setAppName] = useState("Notes");
  const [bannerTitle, setBannerTitle] = useState("Astra OS — Admin notice");
  const [bannerBody, setBannerBody] = useState("Please pay attention to this message.");
  const [bannerDur, setBannerDur] = useState(8000);
  const [notifyTitle, setNotifyTitle] = useState("Hello there");
  const [notifyBody, setNotifyBody] = useState("From the Dev Console.");

  const call = useCallback(async (label, path, body) => {
    if (!user?.id) return;
    setBusy(true); setMsg("");
    try {
      const r = await axios({
        method: "POST",
        url: `${API}/admin/users/${user.id}/${path}`,
        headers: { Authorization: `Bearer ${token}` },
        data: body || {},
      });
      const extras = [];
      if (r.data?.sent) extras.push(`delivered to ${r.data.sent} socket(s)`);
      if (r.data?.kicked) extras.push(`kicked ${r.data.kicked}`);
      if (r.data?.fingerprints_banned) extras.push(`${r.data.fingerprints_banned} device(s) banned`);
      setMsg(`✓ ${label}${extras.length ? " — " + extras.join(", ") : ""}`);
    } catch (e) {
      setMsg(`✗ ${label}: ${e.response?.data?.detail || e.message}`);
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(""), 5000);
    }
  }, [user, token]);

  // Refresh user data periodically (online state etc.)
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const { data } = await axios.get(`${API}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const u = (data.users || []).find((x) => x.id === user?.id);
        if (u) setUser(u);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { cancelled = true; clearInterval(id); };
  }, [token, user?.id]);

  if (!user) {
    return <div className="ax-files-empty" style={{ padding: 30 }}>No target selected.</div>;
  }

  return (
    <div className="ax-rc" data-testid={`remote-control-${user.username}`}>
      {/* HEADER — user identity */}
      <div className="ax-rc-head">
        <div className={`ax-rc-avatar`} style={{ background: `linear-gradient(135deg, #6366f1, ${user.is_dev ? "#22d3ee" : "#a855f7"})` }}>
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="ax-rc-headinfo">
          <div className="ax-rc-name">
            {user.username}
            {user.is_dev && <span className="ax-chat-devchip" style={{ marginLeft: 6 }}>dev</span>}
            {user.is_banned && <span className="ax-dev-banchip">banned</span>}
          </div>
          <div className="ax-rc-meta">
            <span className={`ax-rc-statedot ${user.online ? "on" : "off"}`} />
            {user.online ? "online — listening" : "offline"} · id {user.id.slice(0, 8)}
          </div>
        </div>
        <div className="ax-rc-livedot" title="live" />
      </div>

      {msg && <div className="ax-dev-msg" data-testid="rc-msg">{msg}</div>}

      {/* SECTION — Quick actions */}
      <div className="ax-rc-section">
        <div className="ax-rc-section-head">
          <Activity size={11} strokeWidth={1.9} /> Quick actions
        </div>
        <div className="ax-rc-quickgrid">
          <button onClick={() => call("Close all windows", "closeall")} disabled={!user.online || busy}
                  data-testid="rc-closeall">
            <XIcon size={13} strokeWidth={1.8} /><span>Close all apps</span>
          </button>
          <button onClick={() => call("Force logout", "logout")} disabled={!user.online || busy}
                  data-testid="rc-logout">
            <LogOut size={13} strokeWidth={1.8} /><span>Force logout</span>
          </button>
          <button onClick={() => call("Kick", "kick")} disabled={!user.online || busy}
                  data-testid="rc-kick">
            <Power size={13} strokeWidth={1.8} /><span>Kick socket</span>
          </button>
          {user.is_banned ? (
            <button className="ok" onClick={() => call("Unban", "unban")} disabled={busy} data-testid="rc-unban">
              <ShieldAlert size={13} strokeWidth={1.8} /><span>Unban account</span>
            </button>
          ) : (
            <button className="danger" onClick={() => {
              const r = window.prompt("Ban reason (optional):", "");
              if (r === null) return;
              call("Ban", "ban", { reason: r });
            }} disabled={user.is_dev || busy} data-testid="rc-ban">
              <ShieldAlert size={13} strokeWidth={1.8} /><span>Ban account</span>
            </button>
          )}
          {user.hw_banned ? (
            <button className="ok" onClick={() => call("HW unban", "hwunban")} disabled={busy} data-testid="rc-hwunban">
              <Cpu size={13} strokeWidth={1.8} /><span>Unban device</span>
            </button>
          ) : (
            <button className="danger" onClick={() => {
              if (!window.confirm("Hardware-ban every device this user has signed in from?")) return;
              const r = window.prompt("Reason (optional):", "");
              if (r === null) return;
              call("HW Ban", "hwban", { reason: r });
            }} disabled={user.is_dev || busy} data-testid="rc-hwban">
              <Cpu size={13} strokeWidth={1.8} /><span>Hardware ban</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION — Send */}
      <div className="ax-rc-section">
        <div className="ax-rc-section-head"><Send size={11} strokeWidth={1.9} /> Notify</div>
        <input className="ax-rc-input" value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)}
               placeholder="Title" maxLength={80} data-testid="rc-notify-title" />
        <textarea className="ax-rc-textarea" value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)}
                  placeholder="Body" maxLength={400} data-testid="rc-notify-body" />
        <button className="ax-rc-go" onClick={() => call("Notify", "notify", { title: notifyTitle, body: notifyBody })}
                disabled={!user.online || busy || !notifyTitle.trim() || !notifyBody.trim()}
                data-testid="rc-notify-send">
          <Send size={12} strokeWidth={1.9} /> Send notification
        </button>
      </div>

      {/* SECTION — Launch app */}
      <div className="ax-rc-section">
        <div className="ax-rc-section-head"><Rocket size={11} strokeWidth={1.9} /> Force-launch an app</div>
        <select className="ax-rc-input" value={appName} onChange={(e) => setAppName(e.target.value)} data-testid="rc-launch-app">
          {APP_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="ax-rc-go" onClick={() => call("Launch", "launch", { app: appName })}
                disabled={!user.online || busy} data-testid="rc-launch-send">
          <Rocket size={12} strokeWidth={1.9} /> Open {appName} on their screen
        </button>
      </div>

      {/* SECTION — Navigate */}
      <div className="ax-rc-section">
        <div className="ax-rc-section-head"><LinkIcon size={11} strokeWidth={1.9} /> Open URL in their Browser</div>
        <input className="ax-rc-input" value={navUrl} onChange={(e) => setNavUrl(e.target.value)}
               placeholder="https://…" data-testid="rc-nav-url" />
        <button className="ax-rc-go" onClick={() => call("Navigate", "navigate", { url: navUrl })}
                disabled={!user.online || busy || !navUrl.trim()} data-testid="rc-nav-send">
          <LinkIcon size={12} strokeWidth={1.9} /> Send to Browser
        </button>
      </div>

      {/* SECTION — Takeover banner */}
      <div className="ax-rc-section">
        <div className="ax-rc-section-head"><AlertTriangle size={11} strokeWidth={1.9} /> Full-screen takeover</div>
        <input className="ax-rc-input" value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)}
               placeholder="Banner title" maxLength={80} data-testid="rc-takeover-title" />
        <textarea className="ax-rc-textarea" value={bannerBody} onChange={(e) => setBannerBody(e.target.value)}
                  placeholder="Banner body" maxLength={600} data-testid="rc-takeover-body" />
        <div className="ax-rc-row">
          <label className="ax-rc-small">duration (ms)</label>
          <input className="ax-rc-input ax-rc-small-input" type="number" min="500" max="120000" step="500"
                 value={bannerDur} onChange={(e) => setBannerDur(parseInt(e.target.value, 10) || 8000)}
                 data-testid="rc-takeover-dur" />
        </div>
        <button className="ax-rc-go danger"
                onClick={() => call("Takeover banner", "takeover", { title: bannerTitle, body: bannerBody, duration_ms: bannerDur })}
                disabled={!user.online || busy || !bannerTitle.trim() || !bannerBody.trim()}
                data-testid="rc-takeover-send">
          <AlertTriangle size={12} strokeWidth={1.9} /> Take over their screen
        </button>
      </div>
    </div>
  );
}
