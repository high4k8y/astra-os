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

function isImageAvatar(value) {
  return typeof value === "string" && value.startsWith("img:");
}

function avatarUrl(value) {
  return isImageAvatar(value) ? value.slice(4) : null;
}

export default function Chat() {
  const { token, user, fingerprint, refreshMe } = useAuth();
  const { settings } = useSettings();
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("connecting");
  const [selectedChannel, setSelectedChannel] = useState("general");
  const [selectedUser, setSelectedUser] = useState(null);
  const [dmMessages, setDmMessages] = useState({});
  const [dmContacts, setDmContacts] = useState([]);
  const [profileCache, setProfileCache] = useState({});
  const [profileUser, setProfileUser] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileTab, setProfileTab] = useState("profile");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    profile_emoji: user?.profile_emoji || "◇",
    profile_color: user?.profile_color || "#5865f2",
    profile_banner: user?.profile_banner || "",
    profile_bio: user?.profile_bio || "",
    status_emoji: user?.status_emoji || "🟢",
    status_text: user?.status_text || "",
    badges: user?.badges || [],
  });

  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const reconnectRef = useRef(0);

  const BADGE_OPTIONS = [
  { id: "developer", title: "Developer", icon: Code2, className: "developer" },
  { id: "staff", title: "Staff", icon: Shield, className: "staff" },
  { id: "trusted", title: "HypeSquad", icon: Star, className: "hypesquad" },
  { id: "beta", title: "Bug Hunter", icon: Zap, className: "bughunter" },
  { id: "founder", title: "Partner", icon: Crown, className: "partner" },
  { id: "moderator", title: "Moderator", icon: Award, className: "moderator" },
  ];

  const PROFILE_AVATARS = [
    { id: "anima", src: "https://api.dicebear.com/6.x/adventurer/png?seed=Anima&size=96", label: "Anima", color: "#7c3aed" },
    { id: "lucia", src: "https://api.dicebear.com/6.x/adventurer/png?seed=Lucia&size=96", label: "Lucia", color: "#ec4899" },
    { id: "orion", src: "https://api.dicebear.com/6.x/bottts/png?seed=Orion&size=96", label: "Orion", color: "#0ea5e9" },
    { id: "nora", src: "https://api.dicebear.com/6.x/open-peeps/png?seed=Nora&size=96", label: "Nora", color: "#f59e0b" },
    { id: "kai", src: "https://api.dicebear.com/6.x/avataaars/png?seed=Kai&size=96", label: "Kai", color: "#22c55e" },
    { id: "miran", src: "https://api.dicebear.com/6.x/identicon/png?seed=Miran&size=96", label: "Miran", color: "#8b5cf6" },
    { id: "sera", src: "https://api.dicebear.com/6.x/adventurer/png?seed=Sera&size=96", label: "Sera", color: "#14b8a6" },
    { id: "zane", src: "https://api.dicebear.com/6.x/bottts/png?seed=Zane&size=96", label: "Zane", color: "#f97316" },
  ];

  const NAME_TEMPLATES = [
    "NovaPulse",
    "EchoShade",
    "StarLoom",
    "VoidShift",
    "CipherRune",
    "AstraFrost",
    "LunaDrift",
    "PixelTorrent",
    "NeonWarden",
    "QuartzFury",
  ];

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      username: user.username || "",
      profile_emoji: user.profile_emoji || "◇",
      profile_color: user.profile_color || "#5865f2",
      profile_banner: user.profile_banner || "",
      profile_bio: user.profile_bio || "",
      status_emoji: user.status_emoji || "🟢",
      status_text: user.status_text || "",
      badges: user.badges || [],
    });
  }, [user]);

  useEffect(() => {
    if (editingProfile) {
      setProfileTab("profile");
    }
  }, [editingProfile]);

  const saveProfile = async () => {
    if (!token) return;
    setProfileError("");
    setSavingProfile(true);
    try {
      const body = {
        profile_emoji: profileForm.profile_emoji,
        profile_color: profileForm.profile_color,
        profile_banner: profileForm.profile_banner,
        profile_bio: profileForm.profile_bio,
        status_emoji: profileForm.status_emoji,
        status_text: profileForm.status_text,
      };
      const trimmedUsername = (profileForm.username || "").trim();
      if (trimmedUsername) {
        body.username = trimmedUsername;
      }
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
          const { data } = await axios.get(`${API}/chat/history?limit=80&channel=${encodeURIComponent(selectedChannel)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!cancel) setMessages(data || []);
        } catch (e) { }
      })();
    }
    return () => { cancel = true; };
  }, [token, selectedUser, selectedChannel]);

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
              return [...prev, {
                id: dm.from_user_id,
                username: dm.from_username,
                role: dm.role || "member",
                badges: dm.badges || [],
                profile_emoji: dm.profile_emoji || dm.from_username?.charAt(0).toUpperCase(),
                profile_color: dm.profile_color || "#5865f2",
                is_dev: dm.is_dev || false,
              }];
            });
          } else if (obj.type === "online") {
            setOnline(obj.users || []);
          } else if (obj.type === "delete") {
            setMessages((m) => m.filter((x) => x.id !== obj.id));
          }
        } catch { }
      };
      ws.onclose = () => {
        // Don't show offline; silently reconnect in background
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
  }, [token, fingerprint, user?.id]);

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
        role: user?.role,
        badges: user?.badges || [],
        profile_emoji: user?.profile_emoji || "◇",
        profile_color: user?.profile_color || "#5865f2",
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
      wsRef.current.send(JSON.stringify({ text, channel: selectedChannel }));
    }

    setInput("");
  };

  const visibleMessages = selectedUser
    ? (dmMessages[selectedUser.id] || [])
    : messages.filter((m) => (m.channel || "general") === selectedChannel);
  const currentMessages = visibleMessages;
  const currentTitle = selectedUser
    ? `DM with ${selectedUser.username}`
    : selectedChannel === "general"
      ? "# general"
      : `# ${selectedChannel}`;
  const emptyText = selectedUser
    ? "No direct messages yet"
    : `Welcome to ${currentTitle}`;

  const groupedMessages = [];
  let currentGroup = null;
  currentMessages.forEach((m) => {
    if (!selectedUser && m.kind === "system") {
      groupedMessages.push({ type: "system", message: m });
      currentGroup = null;
      return;
    }
    const userId = m.user_id || m.from_user_id;
    const username = selectedUser ? m.from_username : m.username;
    const mine = selectedUser ? m.from_user_id === user?.id : m.username === user?.username;
    const groupKey = `${userId}:${mine}`;

    const shouldStartNewGroup = !currentGroup || currentGroup.groupKey !== groupKey;
    if (shouldStartNewGroup) {
      currentGroup = {
        type: "group",
        groupKey,
        userId,
        username,
        mine,
        profile_emoji: m.profile_emoji || username?.charAt(0).toUpperCase(),
        profile_color: m.profile_color || "#5865f2",
        role: m.role,
        badges: m.badges || [],
        is_dev: m.is_dev,
        messages: [m],
      };
      groupedMessages.push(currentGroup);
    } else {
      currentGroup.messages.push(m);
    }
  });

  const renderMessageText = (text) => {
    return text.split(/(@[A-Za-z0-9_-]+)/g).map((part, index) => {
      if (part.startsWith("@")) {
        return <span key={index} className="mention">{part}</span>;
      }
      return part;
    });
  };

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
    <div className="chat-layout">
      <aside className="chat-sidebar">
        <div className="server-preview">
          <div className="server-icon preview-avatar" style={{ background: user?.profile_color || "#5865f2" }}>
            {user?.profile_emoji || "◇"}
          </div>
          <div className="server-name preview-info">
            <strong>{user?.username || "Guest"}</strong>
            <span>{user?.status_text ? `${user.status_emoji || "🟢"} ${user.status_text}` : "Active now"}</span>
            <small>{user?.role?.toUpperCase() || "MEMBER"}</small>
          </div>
        </div>

        <div className="sidebar-channels">
          <div className="sidebar-section-title">CHANNELS</div>
          {[
            { id: "general", label: "general" },
            { id: "updates", label: "updates" },
            ...(user?.is_dev ? [{ id: "dev-updates", label: "dev-updates" }, { id: "dev-todo", label: "dev-todo" }] : []),
          ].map((channel) => (
            <button
              key={channel.id}
              className={`channel ${selectedChannel === channel.id && !selectedUser ? "active" : ""}`}
              onClick={() => { setSelectedChannel(channel.id); setSelectedUser(null); }}
            >
              <span className="channel-hash">#</span>
              {channel.label}
            </button>
          ))}
        </div>

        <div className="sidebar-divider"></div>

        <div className="dm-header">
          <span>DIRECT MESSAGES</span>
          <div className="dm-action">
            <span>{dmContacts.length} contacts</span>
          </div>
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

        <div className="online-header">
          <span>ONLINE</span>
          <small>Click to view profile</small>
        </div>
        <div className="online-list">
          {online.map((u) => (
            <button key={u.id} className="online-item" type="button" onClick={() => openProfile(u.id)}>
              <span className="online-avatar" style={{ background: u.profile_color || "#5865f2" }}>
                {u.profile_emoji || u.username?.charAt(0).toUpperCase()}
              </span>
              <span>{u.username}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="chat-main">
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
            <button className="header-icon-btn" onClick={() => setEditingProfile(true)} title="Settings">
              <Settings size={16} />
            </button>
          </div>
        </div>

        <div className="messages-container" ref={scrollRef}>
          {currentMessages.length === 0 && (
            <div className="empty-messages">{emptyText}</div>
          )}
          {groupedMessages.map((group) => {
            if (group.type === "system") {
              return (
                <div key={group.message.id} className="system-message">
                  {group.message.text}
                </div>
              );
            }
            return (
              <div key={group.groupKey + group.messages[0].id} className={`message-group ${group.mine ? "own" : ""}`}>
                <div className="message-avatar" style={{ background: group.profile_color || "#5865f2" }}>
                  {avatarUrl(group.profile_emoji) ? (
                    <img src={avatarUrl(group.profile_emoji)} alt={group.username} />
                  ) : (
                    group.profile_emoji
                  )}
                </div>
                <div className="message-group-body">
                  <div className="message-group-header">
                    <div className="message-group-author">
                      <span className="author" onClick={() => group.userId && openProfile(group.userId)}>
                        {group.username}
                      </span>
                      {group.is_dev && <span className="badge badge-developer" title="Developer"><Code2 size={10} /></span>}
                      {group.role && group.role !== "member" && group.role !== "staff" && (
                        <span className="badge badge-role" title={group.role}>{group.role.toUpperCase()}</span>
                      )}
                      {group.role === "staff" && <span className="badge badge-staff" title="Staff"><Shield size={10} /></span>}
                      {group.badges?.map((b) => {
                        const opt = BADGE_OPTIONS.find((x) => x.id === b);
                        const Icon = opt?.icon;
                        return (
                          <span key={b} className={`badge badge-${opt?.className || b}`} title={opt?.title || b}>
                            {Icon && <Icon size={10} />}
                          </span>
                        );
                      })}
                    </div>
                    <span className="timestamp">{fmtTime(group.messages[group.messages.length - 1].ts)}</span>
                  </div>
                  {group.messages.map((m) => (
                    <div key={m.id} className={`message-bubble ${m.role === "staff" ? "staff-message" : ""}`}>
                      <div className="message-text">{renderMessageText(m.text)}</div>
                      {(m.is_dev || m.role === "staff" || (m.role && m.role !== "member") || m.badges?.length > 0) && (
                        <div className="message-footer">
                          <span>{fmtTime(m.ts)}</span>
                          {m.is_dev && <span className="tag-small">DEV</span>}
                          {m.role === "staff" && <span className="tag-small staff">STAFF</span>}
                          {m.role && m.role !== "staff" && m.role !== "member" && (
                            <span className="tag-small role-tag">{m.role.toUpperCase()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
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
            placeholder={status === "online" ? (selectedUser ? `Message ${selectedUser.username}...` : `Message ${currentTitle}...`) : "Reconnecting..."}
            disabled={status !== "online"}
            maxLength={500}
            spellCheck="false"
          />
          <button type="submit" disabled={status !== "online" || !input.trim()}>
            <Send size={18} />
          </button>
        </form>
      </main>

      {editingProfile && (
        <div className="profile-overlay" onClick={() => setEditingProfile(false)}>
          <div className="profile-card profile-edit-card" onClick={(e) => e.stopPropagation()}>
            <div className="edit-header">
              <h3>Edit Profile</h3>
              <button className="close-btn" onClick={() => setEditingProfile(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="settings-modal">
              <aside className="settings-sidebar">
                <div className="sidebar-title">USER SETTINGS</div>
                <div className="settings-preview">
                  <div className="preview-avatar" style={{ background: profileForm.profile_color }}>
                    {avatarUrl(profileForm.profile_emoji) ? (
                      <img src={avatarUrl(profileForm.profile_emoji)} alt="Profile" />
                    ) : (
                      profileForm.profile_emoji
                    )}
                  </div>
                  <div className="preview-info">
                    <span>{profileForm.username || user?.username || "Guest"}</span>
                    <small>{profileForm.status_text || "No status set"}</small>
                    <div className="preview-role">{user?.role && user.role !== "member" ? user.role.toUpperCase() : "Member"}</div>
                  </div>
                </div>
                <button
                  className={`settings-tab ${profileTab === "profile" ? "active" : ""}`}
                  onClick={() => setProfileTab("profile")}
                >
                  <span>Profile</span>
                  <small>Avatar, color, and display name</small>
                </button>
                <button
                  className={`settings-tab ${profileTab === "status" ? "active" : ""}`}
                  onClick={() => setProfileTab("status")}
                >
                  <span>Status</span>
                  <small>Status text and bio</small>
                </button>
                {user?.is_dev && (
                  <button
                    className={`settings-tab ${profileTab === "badges" ? "active" : ""}`}
                    onClick={() => setProfileTab("badges")}
                  >
                    <span>Badges</span>
                    <small>Icon badges for your profile</small>
                  </button>
                )}
              </aside>

              <div className="settings-content">
                {profileTab === "profile" && (
                  <section>
                    <div className="section-heading">
                      <h4>Profile</h4>
                      <p>Choose your avatar and accent color for chat.</p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <label style={{ margin: 0 }}>Display name</label>
                      <span style={{ fontSize: 12, color: "#b9bbbe" }}>Your current username is {user?.username || "Guest"}</span>
                    </div>
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value }))}
                      maxLength={24}
                      placeholder="Choose a display name"
                    />
                    <div className="name-template-grid">
                      {NAME_TEMPLATES.map((name) => (
                        <button
                          key={name}
                          type="button"
                          className={`name-template ${profileForm.username === name ? "active" : ""}`}
                          onClick={() => setProfileForm((f) => ({ ...f, username: name }))}
                        >
                          {name}
                        </button>
                      ))}
                    </div>

                    <label>Choose profile picture</label>
                    <div className="avatar-grid avatar-grid-pics">
                      {PROFILE_AVATARS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`avatar-option ${avatarUrl(profileForm.profile_emoji) === item.src ? "selected" : ""}`}
                          style={{ background: item.color }}
                          onClick={() => setProfileForm((f) => ({ ...f, profile_emoji: `img:${item.src}`, profile_color: item.color }))}
                        >
                          <img src={item.src} alt={item.label} />
                        </button>
                      ))}
                    </div>

                    <label>Custom avatar URL</label>
                    <input
                      type="url"
                      value={avatarUrl(profileForm.profile_emoji) || ""}
                      onChange={(e) => {
                        const url = e.target.value;
                        setProfileForm((f) => ({ ...f, profile_emoji: url ? `img:${url}` : f.profile_emoji }));
                      }}
                      placeholder="https://example.com/avatar.png"
                    />

                    <label>Avatar Color</label>
                    <input
                      type="color"
                      value={profileForm.profile_color}
                      onChange={(e) => setProfileForm((f) => ({ ...f, profile_color: e.target.value }))}
                    />
                  </section>
                )}

                {profileTab === "status" && (
                  <section>
                    <div className="section-heading">
                      <h4>Status</h4>
                      <p>Set a short status message and bio for chat.</p>
                    </div>

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

                    <label>Banner URL</label>
                    <input
                      type="url"
                      value={profileForm.profile_banner}
                      onChange={(e) => setProfileForm((f) => ({ ...f, profile_banner: e.target.value }))}
                      placeholder="https://example.com/banner.png"
                    />

                    <label>Bio</label>
                    <textarea
                      value={profileForm.profile_bio}
                      onChange={(e) => setProfileForm((f) => ({ ...f, profile_bio: e.target.value }))}
                      maxLength={256}
                      placeholder="Tell us about yourself"
                      rows={5}
                    />
                  </section>
                )}

                {profileTab === "badges" && user?.is_dev && (
                  <section>
                    <div className="section-heading">
                      <h4>Badges</h4>
                      <p>Toggle your icon badges for chat.</p>
                    </div>

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
                  </section>
                )}

                {profileError && <div className="error">{profileError}</div>}

                <button className="save-btn" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {profileUser && (
        <div className="profile-overlay" onClick={closeProfile}>
          <div className="profile-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeProfile}><X size={20} /></button>
            <div className="card-banner" style={{ backgroundImage: profileUser.profile_banner ? `url(${profileUser.profile_banner})` : undefined, background: profileUser.profile_color || "#5865f2" }}></div>
            <div className="card-avatar" style={{ background: profileUser.profile_color || "#5865f2" }}>
              {profileUser.profile_emoji || profileUser.username?.charAt(0).toUpperCase()}
            </div>

            <h2>{profileUser.username}</h2>
            {profileUser.status_text && (
              <p className="status">{profileUser.status_emoji} {profileUser.status_text}</p>
            )}

            <div className="badges">
              {profileUser.is_dev && <span className="badge badge-developer" title="Developer"><Code2 size={12} /></span>}
              {profileUser.role === "staff" && <span className="badge badge-staff" title="Staff"><Shield size={12} /></span>}
              {profileUser.badges?.map((b) => {
                const opt = BADGE_OPTIONS.find((x) => x.id === b);
                const Icon = opt?.icon;
                return (
                  <span key={b} className={`badge badge-${opt?.className || b}`} title={opt?.title || b}>
                    {Icon && <Icon size={12} />}
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
