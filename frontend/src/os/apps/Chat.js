import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Send, Code2, Wifi, WifiOff, Trash2, X, ArrowLeft, MessageCircle, Shield, Star, Zap, Crown, Award } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useSettings } from "../SettingsContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function wsUrl(token, fp) {
  const base = process.env.REACT_APP_BACKEND_URL || "";
  const proto = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "");
  const fpPart = fp ? `&fp=${encodeURIComponent(fp)}` : "";
  return `${proto}://${host}/api/ws/chat?token=${encodeURIComponent(token)}${fpPart}`;
}

function fmtTime(iso) {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function Chat() {
  const { token, user, fingerprint, refreshMe } = useAuth();
  const { settings } = useSettings();
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("connecting"); // connecting | online | offline
  const [selectedUser, setSelectedUser] = useState(null); // null = public chat, {id, username} = DM
  const [dmMessages, setDmMessages] = useState({}); // {userId: [messages]}
  const [dmContacts, setDmContacts] = useState([]);
  const [profileCache, setProfileCache] = useState({});
  const [profileUser, setProfileUser] = useState(null);
  const [chatTab, setChatTab] = useState("messages");
  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    profile_emoji: user?.profile_emoji || "◇",
    profile_color: user?.profile_color || "#6366f1",
    profile_bio: user?.profile_bio || "",
    badges: user?.badges || [],
    banner_color: user?.banner_color || "#5865f2",
    status_emoji: user?.status_emoji || "🟢",
    status_text: user?.status_text || "",
    theme: user?.theme || "dark",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const reconnectRef = useRef(0);

  const BADGE_OPTIONS = [
    { id: "developer", label: "Developer", icon: Code2, color: "#8b5cf6" },
    { id: "staff", label: "Staff", icon: Shield, color: "#f59e0b" },
    { id: "trusted", label: "Trusted", icon: Star, color: "#10b981" },
    { id: "beta", label: "Beta Tester", icon: Zap, color: "#06b6d4" },
    { id: "founder", label: "Founder", icon: Crown, color: "#ec4899" },
    { id: "moderator", label: "Moderator", icon: Award, color: "#3b82f6" },
  ];

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      username: user.username || "",
      profile_emoji: user.profile_emoji || "◇",
      profile_color: user.profile_color || "#6366f1",
      profile_bio: user.profile_bio || "",
      badges: user.badges || [],
      banner_color: user.banner_color || "#5865f2",
      status_emoji: user.status_emoji || "🟢",
      status_text: user.status_text || "",
      theme: user.theme || "dark",
    });
  }, [user]);

  const saveProfile = async () => {
    if (!token) return;
    setProfileError("");
    setSavingProfile(true);
    try {
      const body = {
        username: profileForm.username,
        profile_emoji: profileForm.profile_emoji,
        profile_color: profileForm.profile_color,
        profile_bio: profileForm.profile_bio,
        banner_color: profileForm.banner_color,
        status_emoji: profileForm.status_emoji,
        status_text: profileForm.status_text,
        theme: profileForm.theme,
      };
      if (profileForm.badges && user?.is_dev) {
        body.badges = profileForm.badges;
      }
      const { data } = await axios.patch(
        `${API}/users/me/profile`,
        body,
        {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        },
      );
      setSavingProfile(false);
      if (refreshMe) await refreshMe(token);
      setProfileForm((prev) => ({
        ...prev,
        username: data.username || prev.username,
        profile_emoji: data.profile_emoji || prev.profile_emoji,
        profile_color: data.profile_color || prev.profile_color,
        profile_bio: data.profile_bio || prev.profile_bio,
        badges: data.badges || prev.badges,
        banner_color: data.banner_color || prev.banner_color,
        status_emoji: data.status_emoji || prev.status_emoji,
        status_text: data.status_text || prev.status_text,
        theme: data.theme || prev.theme,
      }));
    } catch (e) {
      setSavingProfile(false);
      setProfileError(e.response?.data?.detail || "Unable to save profile.");
    }
  };

  const toggleBadge = (badge) => {
    setProfileForm((prev) => {
      const badges = prev.badges || [];
      const has = badges.includes(badge);
      const nextBadges = has ? badges.filter((b) => b !== badge) : [...badges, badge];
      return { ...prev, badges: nextBadges };
    });
  };

  const openProfile = async (userId) => {
    if (!userId || userId === user?.id) {
      setProfileUser(null);
      return;
    }
    if (profileCache[userId]) {
      setProfileUser(profileCache[userId]);
      return;
    }
    try {
      const { data } = await axios.get(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfileCache((prev) => ({ ...prev, [userId]: data }));
      setProfileUser(data);
    } catch (e) {
      setProfileUser(null);
    }
  };

  const closeProfile = () => setProfileUser(null);

  // DM contact list
  useEffect(() => {
    if (!token) return;
    let cancel = false;

    (async () => {
      try {
        const { data } = await axios.get(`${API}/dm/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancel && data && Array.isArray(data.users)) {
          setDmContacts(data.users || []);
        }
      } catch (e) {
        // ignore dm contact fetch failures
      }
    })();

    return () => { cancel = true; };
  }, [token]);

  // history
  useEffect(() => {
    let cancel = false;
    if (selectedUser) {
      // Load DM history
      (async () => {
        try {
          const { data } = await axios.get(`${API}/dm/history/${selectedUser.id}?limit=80`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancel) {
            setDmMessages((prev) => ({ ...prev, [selectedUser.id]: data || [] }));
          }
        } catch (e) { /* ignore */ }
      })();
    } else {
      // Load public chat history
      (async () => {
        try {
          const { data } = await axios.get(`${API}/chat/history?limit=80`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancel) setMessages(data || []);
        } catch (e) { /* ignore */ }
      })();
    }
    return () => { cancel = true; };
  }, [token, selectedUser]);

  // websocket
  useEffect(() => {
    if (!token) return;
    let closed = false;

    const open = () => {
      const ws = new WebSocket(wsUrl(token, fingerprint));
      wsRef.current = ws;

      ws.onopen = () => { setStatus("online"); reconnectRef.current = 0; };
      ws.onmessage = (ev) => {
        try {
          const obj = JSON.parse(ev.data);
          if (obj.type === "message") {
            setMessages((m) => [...m, obj.data]);
          } else if (obj.type === "dm") {
            const dm = obj.data;
            const fromUserId = dm.from_user_id;
            setDmMessages((prev) => ({
              ...prev,
              [fromUserId]: [...(prev[fromUserId] || []), dm],
            }));
            setDmContacts((prev) => {
              if (prev.some((u) => u.id === dm.from_user_id) || dm.from_user_id === user?.id) {
                return prev;
              }
              return [...prev, { id: dm.from_user_id, username: dm.from_username, is_dev: false }];
            });
          } else if (obj.type === "online") {
            setOnline(obj.users || []);
          } else if (obj.type === "delete") {
            setMessages((m) => m.filter((x) => x.id !== obj.id));
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
  }, [token, fingerprint]);

  // autoscroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, dmMessages, selectedUser]);

  const send = (e) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (selectedUser) {
      const payload = { type: "dm", to_user_id: selectedUser.id, text };
      wsRef.current.send(JSON.stringify(payload));
      const localMessage = {
        id: `local-${Date.now()}`,
        from_user_id: user?.id,
        from_username: user?.username,
        to_user_id: selectedUser.id,
        text,
        ts: new Date().toISOString(),
      };
      setDmMessages((prev) => ({
        ...prev,
        [selectedUser.id]: [...(prev[selectedUser.id] || []), localMessage],
      }));
      setDmContacts((prev) => {
        if (prev.some((u) => u.id === selectedUser.id)) return prev;
        return [...prev, selectedUser];
      });
    } else {
      wsRef.current.send(JSON.stringify({ text }));
    }

    setInput("");
  };

  const currentMessages = selectedUser ? (dmMessages[selectedUser.id] || []) : messages;
  const currentTitle = selectedUser ? `DM with ${selectedUser.username}` : "Public chat";
  const emptyText = selectedUser
    ? "No direct messages yet — send a private message to start the conversation."
    : "No messages yet — say hi 👋";

  const deleteMessage = async (m) => {
    const mine = selectedUser ? m.from_user_id === user?.id : m.username === user?.username;
    if (!mine && !user?.is_dev) return;
    const name = selectedUser ? m.from_username : m.username;
    const label = user?.is_dev && !mine ? `Delete ${name}'s message?` : "Delete this message?";
    if (!window.confirm(label)) return;
    try {
      const url = selectedUser
        ? `${API}/dm/messages/${m.id}`
        : user?.is_dev
          ? `${API}/admin/chat/${m.id}`
          : `${API}/chat/messages/${m.id}`;
      await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      window.alert(e.response?.data?.detail || "Failed to delete.");
    }
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
          <button
            type="button"
            className={`ax-chat-roster-item ${selectedUser ? "" : "selected"}`}
            onClick={() => setSelectedUser(null)}
          >
            <span className="ax-chat-avatar" style={{ background: "#6b7280" }}>#</span>
            <span className="ax-chat-name">Public chat</span>
          </button>

          {dmContacts.length > 0 && <div className="ax-chat-section-title">Direct messages</div>}
          {dmContacts.length === 0 ? (
            <div className="ax-chat-empty">No DM contacts yet</div>
          ) : dmContacts.map((u) => (
            <button
              key={u.id}
              type="button"
              className={`ax-chat-roster-item ${selectedUser?.id === u.id ? "selected" : ""}`}
              onClick={() => setSelectedUser(u)}
              data-testid={`chat-dm-user-${u.username}`}
            >
              <span className="ax-chat-avatar" style={{ background: u.profile_color || "#6b7280" }}>{u.username?.charAt(0).toUpperCase() || "◇"}</span>
              <div className="ax-chat-roster-info">
                <span className="ax-chat-name">{u.username}</span>
                <div className="ax-chat-roster-badges">
                  {u.is_dev && <span className="ax-chat-badge-small dev" title="developer"><Code2 size={8} /></span>}
                  {u.role === "trusted" && <span className="ax-chat-badge-small trusted" title="trusted"><Star size={8} /></span>}
                  {u.badges?.map((b) => <span key={b} className={`ax-chat-badge-small ${b}`} title={b}></span>)}
                </div>
              </div>
            </button>
          ))}

          <div className="ax-chat-section-title">Online</div>
          {online.length === 0 && <div className="ax-chat-empty">no one else here</div>}
          {online.map((u) => (
            <button
              key={u.id}
              type="button"
              className={`ax-chat-roster-item ${u.id === user?.id ? "me" : ""} ${selectedUser?.id === u.id ? "selected" : ""}`}
              data-testid={`chat-user-${u.username}`}
              onClick={() => u.id !== user?.id && setSelectedUser(u)}
            >
              <span className="ax-chat-dot" style={{ background: u.profile_color || "#22c55e" }}></span>
              <span className="ax-chat-avatar-small" style={{ background: u.profile_color || "#22c55e" }}>{u.username?.charAt(0).toUpperCase() || "◇"}</span>
              <div className="ax-chat-roster-info">
                <span className="ax-chat-name">{u.username}</span>
                <div className="ax-chat-roster-badges">
                  {u.is_dev && <span className="ax-chat-badge-small dev" title="developer"><Code2 size={8} /></span>}
                  {u.role === "trusted" && <span className="ax-chat-badge-small trusted" title="trusted"><Star size={8} /></span>}
                  {u.badges?.map((b) => <span key={b} className={`ax-chat-badge-small ${b}`} title={b}></span>)}
                </div>
              </div>
              {u.id === user?.id && <span className="ax-chat-you">you</span>}
            </button>
          ))}
        </div>
      </aside>

      <main className="ax-chat-main">
        <div className="ax-chat-titlebar">
          <span>{currentTitle}</span>
          <div className="ax-chat-tablist">
            <button
              type="button"
              className={`ax-chat-tab ${chatTab === "messages" ? "active" : ""}`}
              onClick={() => setChatTab("messages")}
            >
              Messages
            </button>
            <button
              type="button"
              className={`ax-chat-tab ${chatTab === "profile" ? "active" : ""}`}
              onClick={() => setChatTab("profile")}
            >
              Profile
            </button>
          </div>
          {selectedUser && (
            <button type="button" className="ax-chat-clear" onClick={() => setSelectedUser(null)}>
              <ArrowLeft size={12} /> back
            </button>
          )}
        </div>
        {chatTab === "profile" ? (
          <div className="ax-chat-profile-settings">
            <div className="ax-chat-settings-section-title">Display</div>
            <div className="ax-chat-settings-row">
              <label className="ax-chat-settings-label">Display name</label>
              <input
                className="ax-chat-settings-input"
                value={profileForm.username}
                onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value }))}
                maxLength={32}
              />
            </div>
            <div className="ax-chat-settings-row">
              <label className="ax-chat-settings-label">Avatar emoji</label>
              <input
                className="ax-chat-settings-input"
                value={profileForm.profile_emoji}
                onChange={(e) => setProfileForm((f) => ({ ...f, profile_emoji: e.target.value.slice(0, 2) }))}
                maxLength={2}
                placeholder="◇"
              />
            </div>
            <div className="ax-chat-settings-row">
              <label className="ax-chat-settings-label">Avatar color</label>
              <input
                type="color"
                className="ax-chat-settings-input"
                value={profileForm.profile_color}
                onChange={(e) => setProfileForm((f) => ({ ...f, profile_color: e.target.value }))}
              />
            </div>
            
            <div className="ax-chat-settings-section-title">Profile Card</div>
            <div className="ax-chat-settings-row">
              <label className="ax-chat-settings-label">Banner color</label>
              <input
                type="color"
                className="ax-chat-settings-input"
                value={profileForm.banner_color}
                onChange={(e) => setProfileForm((f) => ({ ...f, banner_color: e.target.value }))}
              />
            </div>
            <div className="ax-chat-settings-row">
              <label className="ax-chat-settings-label">Status emoji</label>
              <input
                className="ax-chat-settings-input"
                value={profileForm.status_emoji}
                onChange={(e) => setProfileForm((f) => ({ ...f, status_emoji: e.target.value.slice(0, 2) }))}
                maxLength={2}
                placeholder="🟢"
              />
            </div>
            <div className="ax-chat-settings-row">
              <label className="ax-chat-settings-label">Status text</label>
              <input
                className="ax-chat-settings-input"
                value={profileForm.status_text}
                onChange={(e) => setProfileForm((f) => ({ ...f, status_text: e.target.value }))}
                maxLength={64}
                placeholder="What's on your mind?"
              />
            </div>
            
            <div className="ax-chat-settings-section-title">About</div>
            <div className="ax-chat-settings-row">
              <label className="ax-chat-settings-label">Bio</label>
              <textarea
                className="ax-chat-settings-input ax-chat-settings-textarea"
                rows={4}
                value={profileForm.profile_bio}
                onChange={(e) => setProfileForm((f) => ({ ...f, profile_bio: e.target.value }))}
                maxLength={256}
                placeholder="Tell us about yourself..."
              />
            </div>

            <div className="ax-chat-settings-section-title">Theme</div>
            <div className="ax-chat-settings-row">
              <label className="ax-chat-settings-label">Theme preference</label>
              <div className="ax-chat-settings-theme-selector">
                {["dark", "light"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`ax-chat-theme-btn ${profileForm.theme === t ? "selected" : ""}`}
                    onClick={() => setProfileForm((f) => ({ ...f, theme: t }))}
                  >
                    {t === "dark" ? "🌙 Dark" : "☀️ Light"}
                  </button>
                ))}
              </div>
            </div>

            {user?.is_dev && (
              <>
                <div className="ax-chat-settings-section-title">Admin: Badges</div>
                <div className="ax-chat-settings-row">
                  <label className="ax-chat-settings-label">Assign badges</label>
                  <div className="ax-chat-settings-badges">
                    {BADGE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`ax-chat-badge-pill ${profileForm.badges?.includes(option.id) ? "selected" : ""}`}
                          onClick={() => toggleBadge(option.id)}
                          title={option.label}
                        >
                          {Icon && <Icon size={12} strokeWidth={2} />}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            {profileError && <div className="ax-chat-settings-error">{profileError}</div>}
            <button
              type="button"
              className="ax-chat-profile-action"
              onClick={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </div>
        ) : (
          <div className="ax-chat-log" ref={scrollRef} data-testid="chat-log">
          {currentMessages.length === 0 && (
            <div className="ax-chat-blank">{emptyText}</div>
          )}
          {currentMessages.map((m) => {
            if (!selectedUser && m.kind === "system") {
              return (
                <div key={m.id} className="ax-chat-sys" data-testid={`chat-msg-${m.id}`}>
                  · {m.text} · <span>{fmtTime(m.ts)}</span>
                </div>
              );
            }
            const userId = m.user_id || m.from_user_id;
            const username = selectedUser ? m.from_username : m.username;
            const mine = selectedUser ? m.from_user_id === user?.id : m.username === user?.username;
            const canDelete = (selectedUser ? mine : mine) || user?.is_dev;
            const avatarLetter = username?.charAt(0).toUpperCase() || "?";
            return (
              <div
                key={m.id}
                className={`ax-chat-msg ${mine ? "mine" : ""}`}
                data-testid={`chat-msg-${m.id}`}
              >
                <span className="ax-chat-msg-avatar" style={{ background: m.profile_color || (mine ? "rgba(99, 102, 241, 0.9)" : "rgba(99, 102, 241, 0.8)") }}>{avatarLetter}</span>
                <div className="ax-chat-msg-bubble">
                  <div className="ax-chat-msg-head">
                    <span
                      className={`ax-chat-msg-name ${userId ? "clickable" : ""}`}
                      onClick={userId ? () => openProfile(userId) : undefined}
                      style={{
                        cursor: userId ? "pointer" : undefined,
                        fontFamily: settings.profileFont === "serif"
                          ? "ui-serif, Georgia, serif"
                          : settings.profileFont === "mono"
                            ? "ui-monospace, SFMono-Regular, monospace"
                            : "inherit",
                      }}
                    >
                      {username}
                    </span>
                    <div className="ax-chat-msg-badges">
                      {(!selectedUser && m.is_dev) && <span className="ax-chat-badge-msg dev"><Code2 size={8} strokeWidth={2} />dev</span>}
                      {(!selectedUser && m.badges) && m.badges.map((b) => <span key={b} className={`ax-chat-badge-msg ${b}`}>{b}</span>)}
                    </div>
                    <span className="ax-chat-msg-time">{fmtTime(m.ts)}</span>
                    {canDelete && (!selectedUser || mine) && (
                      <button
                        className="ax-chat-msg-del"
                        onClick={() => deleteMessage(m)}
                        title={mine ? "Delete your message" : "Delete (admin)"}
                        data-testid={`chat-msg-del-${m.id}`}
                      >
                        <Trash2 size={10} strokeWidth={1.9} />
                      </button>
                    )}
                  </div>
                  <div className="ax-chat-msg-text">{m.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
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

      {profileUser && (
        <div className="ax-chat-profile-modal-overlay" onClick={closeProfile}>
          <div className="ax-chat-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ax-chat-profile-modal-banner" style={{ background: profileUser.banner_color || "#5865f2" }}>
              <button type="button" className="ax-chat-profile-modal-close" onClick={closeProfile}>
                <X size={20} />
              </button>
            </div>
            
            <div className="ax-chat-profile-modal-header">
              <div className="ax-chat-profile-modal-avatar" style={{ background: profileUser.profile_color || "#7c3aed" }}>
                {profileUser.profile_emoji || profileUser.username?.charAt(0).toUpperCase() || "?"}
              </div>
              {profileUser.status_emoji && (
                <div className="ax-chat-profile-status-badge">
                  {profileUser.status_emoji}
                </div>
              )}
            </div>

            <div className="ax-chat-profile-modal-content">
              <div className="ax-chat-profile-modal-name">{profileUser.username}</div>
              
              {profileUser.status_text && (
                <div className="ax-chat-profile-modal-status">
                  {profileUser.status_emoji} {profileUser.status_text}
                </div>
              )}
              
              <div className="ax-chat-profile-modal-badges">
                {profileUser.is_dev && <span className="ax-chat-badge-discord dev" title="Developer"><Code2 size={12} />Developer</span>}
                {profileUser.role === "staff" && <span className="ax-chat-badge-discord staff" title="Staff"><Shield size={12} />Staff</span>}
                {profileUser.role === "trusted" && <span className="ax-chat-badge-discord trusted" title="Trusted"><Star size={12} />Trusted</span>}
                {profileUser.role === "moderator" && <span className="ax-chat-badge-discord moderator" title="Moderator"><Award size={12} />Moderator</span>}
                {profileUser.badges?.map((badge) => {
                  const badgeOpt = BADGE_OPTIONS.find(b => b.id === badge);
                  const BadgeIcon = badgeOpt?.icon;
                  return (
                    <span key={badge} className={`ax-chat-badge-discord ${badge}`} title={badgeOpt?.label || badge}>
                      {BadgeIcon && <BadgeIcon size={12} />}
                      {badgeOpt?.label || badge}
                    </span>
                  );
                })}
              </div>

              {profileUser.profile_bio && (
                <div className="ax-chat-profile-modal-section">
                  <div className="ax-chat-profile-modal-section-title">About Me</div>
                  <div className="ax-chat-profile-modal-bio">
                    {profileUser.profile_bio}
                  </div>
                </div>
              )}

              <div className="ax-chat-profile-modal-meta">
                <div className="ax-chat-profile-modal-meta-item">
                  <span className="ax-chat-profile-modal-meta-label">User ID</span>
                  <span className="ax-chat-profile-modal-meta-value">{profileUser.id}</span>
                </div>
                <div className="ax-chat-profile-modal-meta-item">
                  <span className="ax-chat-profile-modal-meta-label">Joined</span>
                  <span className="ax-chat-profile-modal-meta-value">{profileUser.created_at ? new Date(profileUser.created_at).toLocaleDateString() : "Unknown"}</span>
                </div>
              </div>

              {profileUser.id !== user?.id && (
                <button
                  type="button"
                  className="ax-chat-profile-modal-action"
                  onClick={() => {
                    setSelectedUser({ id: profileUser.id, username: profileUser.username });
                    closeProfile();
                  }}
                >
                  <MessageCircle size={14} /> Send message
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
