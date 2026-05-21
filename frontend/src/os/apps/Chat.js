import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Send, Code2, Wifi, WifiOff, Trash2, X, MessageCircle, Shield, Star, Zap, Crown, Award, Settings } from "lucide-react";
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
  const [status, setStatus] = useState("connecting");
  const [selectedUser, setSelectedUser] = useState(null);
  const [dmMessages, setDmMessages] = useState({});
  const [dmContacts, setDmContacts] = useState([]);
  const [profileCache, setProfileCache] = useState({});
  const [profileUser, setProfileUser] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileForm, setProfileForm] = useState({
    profile_emoji: user?.profile_emoji || "◇",
    profile_color: user?.profile_color || "#5865f2",
    profile_bio: user?.profile_bio || "",
    status_emoji: user?.status_emoji || "🟢",
    status_text: user?.status_text || "",
    badges: user?.badges || [],
  });

  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const reconnectRef = useRef(0);

  const BADGE_OPTIONS = [
    { id: "developer", label: "Developer", icon: Code2 },
    { id: "staff", label: "Staff", icon: Shield },
    { id: "trusted", label: "Trusted", icon: Star },
    { id: "beta", label: "Beta Tester", icon: Zap },
    { id: "founder", label: "Founder", icon: Crown },
    { id: "moderator", label: "Moderator", icon: Award },
  ];

  const AVATAR_PRESETS = [
    "😀", "😎", "👾", "🛡️", "🐉", "⚡", "🌙", "🔥",
    "🐱", "🦊", "🍀", "🌸", "🎮", "🌟", "💎", "🛸",
  ];

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      profile_emoji: user.profile_emoji || "◇",
      profile_color: user.profile_color || "#5865f2",
      profile_bio: user.profile_bio || "",
      status_emoji: user.status_emoji || "🟢",
      status_text: user.status_text || "",
      badges: user.badges || [],
    });
  }, [user]);

  const saveProfile = async () => {
    if (!token) return;
    setProfileError("");
    setSavingProfile(true);
    try {
      const body = {
        profile_emoji: profileForm.profile_emoji,
        profile_color: profileForm.profile_color,
        profile_bio: profileForm.profile_bio,
        status_emoji: profileForm.status_emoji,
        status_text: profileForm.status_text,
      };
      if (profileForm.badges && user?.is_dev) {
        body.badges = profileForm.badges;
      }
      await axios.patch(`${API}/users/me/profile`, body, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setSavingProfile(false);
      if (refreshMe) await refreshMe(token);
      setEditingProfile(false);
    } catch (e) {
      setSavingProfile(false);
      setProfileError(e.response?.data?.detail || "Failed to save profile");
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
      } catch (e) { }
    })();
    return () => { cancel = true; };
  }, [token]);

  useEffect(() => {
    let cancel = false;
    if (selectedUser) {
      (async () => {
        try {
          const { data } = await axios.get(`${API}/dm/history/${selectedUser.id}?limit=80`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancel) {
            setDmMessages((prev) => ({ ...prev, [selectedUser.id]: data || [] }));
          }
        } catch (e) { }
      })();
    } else {
      (async () => {
        try {
          const { data } = await axios.get(`${API}/chat/history?limit=80`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancel) setMessages(data || []);
        } catch (e) { }
      })();
    }
    return () => { cancel = true; };
  }, [token, selectedUser]);

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
        } catch { }
      };
      ws.onclose = () => {
        setStatus("offline");
        if (closed) return;
        const delay = Math.min(1000 * 2 ** reconnectRef.current, 8000);
        reconnectRef.current += 1;
        setTimeout(() => { if (!closed) open(); }, delay);
      };
      ws.onerror = () => { try { ws.close(); } catch { } };
    };

    open();
    return () => {
      closed = true;
      try { wsRef.current && wsRef.current.close(); } catch { }
    };
  }, [token, fingerprint]);

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
  const currentTitle = selectedUser ? `DM with ${selectedUser.username}` : "# general";
  const emptyText = selectedUser
    ? "No direct messages yet"
    : "Welcome to general chat";

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
    <div className="discord-layout">
      <aside className="discord-sidebar">
        <div className="discord-server">
          <div className="server-icon">#</div>
          <div className="server-name">Server</div>
        </div>

        <div className="sidebar-channels">
          <button
            className={`channel ${!selectedUser ? "active" : ""}`}
            onClick={() => setSelectedUser(null)}
          >
            # general
          </button>
        </div>

        <div className="sidebar-divider"></div>

        <div className="dm-header">
          <span>DIRECT MESSAGES</span>
        </div>

        <div className="dm-list">
          {dmContacts.length === 0 ? (
            <div className="empty-state">No DMs</div>
          ) : dmContacts.map((u) => (
            <button
              key={u.id}
              className={`dm-item ${selectedUser?.id === u.id ? "active" : ""}`}
              onClick={() => setSelectedUser(u)}
            >
              <span className="dm-avatar" style={{ background: u.profile_color || "#5865f2" }}>
                {u.username?.charAt(0).toUpperCase()}
              </span>
              <span>{u.username}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="discord-main">
        <div className="channel-header">
          <div className="header-left">
            <span className="channel-name">{currentTitle}</span>
          </div>
          <div className="header-right">
            {status === "online" ? (
              <>
                <Wifi size={16} style={{ color: "#43b581" }} />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff size={16} style={{ color: "#f04747" }} />
                <span>Offline</span>
              </>
            )}
            <span className="user-count">{online.length}</span>
          </div>
        </div>

        <div className="messages-container" ref={scrollRef}>
          {currentMessages.length === 0 && (
            <div className="empty-messages">{emptyText}</div>
          )}
          {currentMessages.map((m) => {
            if (!selectedUser && m.kind === "system") {
              return (
                <div key={m.id} className="system-message">
                  {m.text}
                </div>
              );
            }
            const userId = m.user_id || m.from_user_id;
            const username = selectedUser ? m.from_username : m.username;
            const mine = selectedUser ? m.from_user_id === user?.id : m.username === user?.username;
            const canDelete = (selectedUser ? mine : mine) || user?.is_dev;

            return (
              <div key={m.id} className={`message ${mine ? "own" : ""}`}>
                <div className="message-avatar" style={{ background: m.profile_color || "#5865f2" }}>
                  {m.profile_emoji || username?.charAt(0).toUpperCase()}
                </div>
                <div className="message-content">
                  <div className="message-header">
                    <span className="author" onClick={() => userId && openProfile(userId)}>
                      {username}
                    </span>
                    {m.is_dev && <span className="badge-dev"><Code2 size={10} />Developer</span>}
                    {m.role === "staff" && <span className="badge-staff"><Shield size={10} />Staff</span>}
                    {m.badges?.map((b) => {
                      const opt = BADGE_OPTIONS.find(x => x.id === b);
                      const Icon = opt?.icon;
                      return (
                        <span key={b} className={`badge badge-${b}`}>
                          {Icon && <Icon size={10} />}
                          {opt?.label}
                        </span>
                      );
                    })}
                    <span className="timestamp">{fmtTime(m.ts)}</span>
                    {canDelete && (
                      <button className="delete-btn" onClick={() => deleteMessage(m)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="message-text">{m.text}</div>
                </div>
              </div>
            );
          })}
        </div>

        <form className="message-input" onSubmit={send}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={status === "online" ? "Message #general..." : "Reconnecting..."}
            disabled={status !== "online"}
            maxLength={500}
            spellCheck="false"
          />
          <button type="submit" disabled={status !== "online" || !input.trim()}>
            <Send size={18} />
          </button>
        </form>
      </main>

      <aside className="user-panel">
        {editingProfile ? (
          <div className="profile-edit">
            <div className="edit-header">
              <h3>Edit Profile</h3>
              <button className="close-btn" onClick={() => setEditingProfile(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="form">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <label style={{ margin: 0 }}>Username</label>
                <span style={{ fontSize: 12, color: "#b9bbbe" }}>{user?.username || "Guest"}</span>
              </div>

              <label>Choose avatar</label>
              <div className="avatar-grid">
                {AVATAR_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`avatar-option ${profileForm.profile_emoji === emoji ? "selected" : ""}`}
                    onClick={() => setProfileForm((f) => ({ ...f, profile_emoji: emoji }))}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <label>Custom avatar</label>
              <input
                value={profileForm.profile_emoji}
                onChange={(e) => setProfileForm((f) => ({ ...f, profile_emoji: e.target.value.slice(0, 2) }))}
                maxLength={2}
                placeholder="Pick or type an emoji"
              />

              <label>Avatar Color</label>
              <input
                type="color"
                value={profileForm.profile_color}
                onChange={(e) => setProfileForm((f) => ({ ...f, profile_color: e.target.value }))}
              />

              <label>Status Emoji</label>
              <input
                value={profileForm.status_emoji}
                onChange={(e) => setProfileForm((f) => ({ ...f, status_emoji: e.target.value.slice(0, 2) }))}
                maxLength={2}
              />

              <label>Status Text</label>
              <input
                value={profileForm.status_text}
                onChange={(e) => setProfileForm((f) => ({ ...f, status_text: e.target.value }))}
                maxLength={64}
                placeholder="What's up?"
              />

              <label>Bio</label>
              <textarea
                value={profileForm.profile_bio}
                onChange={(e) => setProfileForm((f) => ({ ...f, profile_bio: e.target.value }))}
                maxLength={256}
                placeholder="Tell us about yourself"
                rows={3}
              />

              {user?.is_dev && (
                <>
                  <label>Badges</label>
                  <div className="badge-grid">
                    {BADGE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          className={`badge-btn ${profileForm.badges?.includes(opt.id) ? "selected" : ""}`}
                          onClick={() => toggleBadge(opt.id)}
                        >
                          {Icon && <Icon size={12} />}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {profileError && <div className="error">{profileError}</div>}

              <button className="save-btn" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="user-card">
            <div className="card-banner" style={{ background: profileForm.profile_color }}></div>
            <div className="card-avatar" style={{ background: profileForm.profile_color }}>
              {profileForm.profile_emoji}
            </div>

            <h3>{user?.username || "Guest"}</h3>
            {profileForm.status_text && (
              <p className="status">{profileForm.status_emoji} {profileForm.status_text}</p>
            )}

            {profileForm.profile_bio && (
              <p className="bio">{profileForm.profile_bio}</p>
            )}

            <div className="badges">
              {user?.is_dev && <span className="badge dev"><Code2 size={10} />Dev</span>}
              {profileUser?.role && profileUser.role !== "member" && !profileUser?.is_dev && (
                <span className={`badge ${profileUser.role}`}>
                  {profileUser.role.charAt(0).toUpperCase() + profileUser.role.slice(1)}
                </span>
              )}
              {profileForm.badges?.map((b) => {
                const opt = BADGE_OPTIONS.find(x => x.id === b);
                const Icon = opt?.icon;
                return (
                  <span key={b} className={`badge ${b}`}>
                    {Icon && <Icon size={10} />}
                    {opt?.label}
                  </span>
                );
              })}
            </div>

            <button className="edit-btn" onClick={() => setEditingProfile(true)}>
              <Settings size={16} />
              Edit Profile
            </button>
          </div>
        )}

        <div className="online-section">
          <h4>ONLINE ({online.length})</h4>
          {online.map((u) => (
            <button
              key={u.id}
              className="online-user"
              onClick={() => u.id !== user?.id && setSelectedUser(u)}
            >
              <span className="avatar" style={{ background: u.profile_color || "#5865f2" }}>
                {u.profile_emoji || u.username?.charAt(0).toUpperCase()}
              </span>
              <span>{u.username}</span>
              {u.is_dev && <span className="dev-tag">dev</span>}
            </button>
          ))}
        </div>
      </aside>

      {profileUser && (
        <div className="profile-overlay" onClick={closeProfile}>
          <div className="profile-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeProfile}><X size={20} /></button>
            <div className="card-banner" style={{ background: profileUser.profile_color || "#5865f2" }}></div>
            <div className="card-avatar" style={{ background: profileUser.profile_color || "#5865f2" }}>
              {profileUser.profile_emoji || profileUser.username?.charAt(0).toUpperCase()}
            </div>

            <h2>{profileUser.username}</h2>
            {profileUser.status_text && (
              <p className="status">{profileUser.status_emoji} {profileUser.status_text}</p>
            )}

            <div className="badges">
              {profileUser.is_dev && <span className="badge dev"><Code2 size={12} />Developer</span>}
              {profileUser.role === "staff" && <span className="badge staff"><Shield size={12} />Staff</span>}
              {profileUser.badges?.map((b) => {
                const opt = BADGE_OPTIONS.find(x => x.id === b);
                const Icon = opt?.icon;
                return (
                  <span key={b} className={`badge ${b}`}>
                    {Icon && <Icon size={12} />}
                    {opt?.label}
                  </span>
                );
              })}
            </div>

            {profileUser.profile_bio && <p className="bio">{profileUser.profile_bio}</p>}

            <div className="meta">
              <div><strong>ID:</strong> {profileUser.id}</div>
              <div><strong>Joined:</strong> {profileUser.created_at ? new Date(profileUser.created_at).toLocaleDateString() : "Unknown"}</div>
            </div>

            {profileUser.id !== user?.id && (
              <button className="msg-btn" onClick={() => { setSelectedUser({ id: profileUser.id, username: profileUser.username }); closeProfile(); }}>
                <MessageCircle size={16} />
                Send Message
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
