import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../auth/AuthContext";
import { Shield, Star, Zap, Crown, Award, Code2, Check } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PROFILE_PICS = [
  { id: "anima", src: "https://api.dicebear.com/6.x/adventurer/png?seed=Anima&size=96", label: "Anima" },
  { id: "lucia", src: "https://api.dicebear.com/6.x/adventurer/png?seed=Lucia&size=96", label: "Lucia" },
  { id: "orion", src: "https://api.dicebear.com/6.x/bottts/png?seed=Orion&size=96", label: "Orion" },
  { id: "nora", src: "https://api.dicebear.com/6.x/open-peeps/png?seed=Nora&size=96", label: "Nora" },
  { id: "kai", src: "https://api.dicebear.com/6.x/avataaars/png?seed=Kai&size=96", label: "Kai" },
  { id: "miran", src: "https://api.dicebear.com/6.x/identicon/png?seed=Miran&size=96", label: "Miran" },
  { id: "sera", src: "https://api.dicebear.com/6.x/adventurer/png?seed=Sera&size=96", label: "Sera" },
  { id: "zane", src: "https://api.dicebear.com/6.x/bottts/png?seed=Zane&size=96", label: "Zane" },
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

const COLOR_CHOICES = [
  "#5865f2", "#7c3aed", "#ec4899", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#0ea5e9", "#8b5cf6", "#14b8a6", "#0f766e", "#334155",
];

const BADGE_OPTIONS = [
  { id: "developer", title: "Developer", icon: Code2 },
  { id: "staff", title: "Staff", icon: Shield },
  { id: "trusted", title: "HypeSquad", icon: Star },
  { id: "beta", title: "Bug Hunter", icon: Zap },
  { id: "founder", title: "Partner", icon: Crown },
  { id: "moderator", title: "Moderator", icon: Award },
];

export default function ProfilePicker() {
  const { user, token, refreshMe } = useAuth();
  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    profile_emoji: user?.profile_emoji || "◇",
    profile_color: user?.profile_color || "#5865f2",
    profile_bio: user?.profile_bio || "",
    status_emoji: user?.status_emoji || "🟢",
    status_text: user?.status_text || "",
    badges: user?.badges || [],
  });

  const [remoteAvatars, setRemoteAvatars] = useState([]);
  const [remotePage, setRemotePage] = useState(1);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState("");

  const isImageAvatar = (value) => typeof value === "string" && value.startsWith("img:");
  const avatarUrl = (value) => (isImageAvatar(value) ? value.slice(4) : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      username: user.username || "",
      profile_emoji: user.profile_emoji || "◇",
      profile_color: user.profile_color || "#5865f2",
      profile_bio: user.profile_bio || "",
      status_emoji: user.status_emoji || "🟢",
      status_text: user.status_text || "",
      badges: user.badges || [],
    });
  }, [user]);

  const fetchDiscordPfp = async (page = 1) => {
    setRemoteLoading(true);
    setRemoteError("");
    try {
      const { data } = await axios.get(`${API}/discordpfp?page=${page}`);
      setRemoteAvatars(Array.isArray(data.avatars) ? data.avatars : []);
      setRemotePage(data.page || page);
    } catch (e) {
      setRemoteError(e.response?.data?.detail || "Unable to load DiscordPFP avatars.");
      setRemoteAvatars([]);
    } finally {
      setRemoteLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscordPfp(1);
  }, []);

  const saveProfile = async () => {
    if (!token) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const body = {
        profile_emoji: profileForm.profile_emoji,
        profile_color: profileForm.profile_color,
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
      setSaving(false);
      setSuccess("Profile saved successfully.");
      if (refreshMe) await refreshMe(token);
    } catch (e) {
      setSaving(false);
      setError(e.response?.data?.detail || "Failed to save profile.");
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

  return (
    <div className="profile-picker-app">
      <div className="picker-header">
        <div>
          <h2>Profile Picker</h2>
          <p>Choose your profile picture, accent color, status, and badges from one place.</p>
        </div>
        <div className="picker-preview" style={{ background: profileForm.profile_color }}>
          {avatarUrl(profileForm.profile_emoji) ? (
            <img src={avatarUrl(profileForm.profile_emoji)} alt="Preview" />
          ) : (
            <span>{profileForm.profile_emoji}</span>
          )}
        </div>
      </div>

      <div className="picker-body">
        <aside className="picker-sidebar">
          <div className="picker-card">
            <div className="picker-card-avatar" style={{ background: profileForm.profile_color }}>
              {avatarUrl(profileForm.profile_emoji) ? (
                <img src={avatarUrl(profileForm.profile_emoji)} alt="Profile" />
              ) : (
                profileForm.profile_emoji
              )}
            </div>
            <div className="picker-card-name">{profileForm.username || user?.username || "Guest"}</div>
            <div className="picker-card-status">{profileForm.status_emoji} {profileForm.status_text || "No status set"}</div>
            <div className="picker-card-badges">
              {profileForm.badges?.map((b) => {
                const opt = BADGE_OPTIONS.find((x) => x.id === b);
                if (!opt) return null;
                const Icon = opt.icon;
                return (
                  <span key={b} className={`badge badge-${opt.id}`} title={opt.title}>
                    {Icon && <Icon size={14} />}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="picker-info">
            <h3>Avatar Gallery</h3>
            <p>Pick from a wide set of profile pictures and colors.</p>
          </div>
        </aside>

        <main className="picker-main">
          <section>
            <div className="section-heading">
              <h4>Pick a profile picture</h4>
              <p>Select from a gallery of avatar styles and characters.</p>
            </div>
            <div className="avatar-grid avatar-grid-pics">
              {PROFILE_PICS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`avatar-option ${avatarUrl(profileForm.profile_emoji) === item.src ? "selected" : ""}`}
                  onClick={() => setProfileForm((f) => ({ ...f, profile_emoji: `img:${item.src}` }))}
                >
                  <img src={item.src} alt={item.label} />
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="section-heading">
              <h4>DiscordPFP Gallery</h4>
              <p>Load avatar art from discordpfp.gg through the backend proxy.</p>
            </div>
            <div className="remote-actions">
              <button type="button" className="save-btn" onClick={() => fetchDiscordPfp(remotePage)} disabled={remoteLoading}>
                {remoteLoading ? "Refreshing…" : "Refresh gallery"}
              </button>
              <button type="button" className="save-btn" onClick={() => fetchDiscordPfp(remotePage + 1)} disabled={remoteLoading}>
                Load page {remotePage + 1}
              </button>
            </div>
            {remoteError && <div className="error" style={{ marginTop: 8 }}>{remoteError}</div>}
            <div className="avatar-grid avatar-grid-pics">
              {remoteLoading ? (
                <div className="loading-card">Loading avatars…</div>
              ) : remoteAvatars.length > 0 ? (
                remoteAvatars.map((src) => (
                  <button
                    key={src}
                    type="button"
                    className={`avatar-option ${avatarUrl(profileForm.profile_emoji) === src ? "selected" : ""}`}
                    onClick={() => setProfileForm((f) => ({ ...f, profile_emoji: `img:${src}` }))}
                  >
                    <img src={src} alt="DiscordPFP avatar" />
                  </button>
                ))
              ) : (
                <div className="empty-state">No DiscordPFP avatars found yet. Try refreshing.</div>
              )}
            </div>
          </section>

          <section>
            <div className="section-heading">
              <h4>Pick a display name</h4>
              <p>Choose a username template or type your own custom name.</p>
            </div>
            <label>Display name</label>
            <input
              type="text"
              value={profileForm.username}
              onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value }))}
              placeholder="Your display name"
              maxLength={24}
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
          </section>

          <section>
            <div className="section-heading">
              <h4>Accent color</h4>
              <p>Choose a profile color for your avatar preview.</p>
            </div>
            <div className="color-grid">
              {COLOR_CHOICES.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-dot ${profileForm.profile_color === color ? "selected" : ""}`}
                  style={{ background: color }}
                  onClick={() => setProfileForm((f) => ({ ...f, profile_color: color }))}
                />
              ))}
            </div>
          </section>

          <section>
            <div className="section-heading">
              <h4>Custom profile</h4>
              <p>Use a custom profile image URL or update your status and bio.</p>
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
            <label>Status emoji</label>
            <input
              value={profileForm.status_emoji}
              onChange={(e) => setProfileForm((f) => ({ ...f, status_emoji: e.target.value.slice(0, 2) }))}
              maxLength={2}
            />
            <label>Status text</label>
            <input
              value={profileForm.status_text}
              onChange={(e) => setProfileForm((f) => ({ ...f, status_text: e.target.value }))}
              placeholder="What's up?"
              maxLength={64}
            />
            <label>Bio</label>
            <textarea
              value={profileForm.profile_bio}
              onChange={(e) => setProfileForm((f) => ({ ...f, profile_bio: e.target.value }))}
              maxLength={200}
              rows={3}
              placeholder="Tell everyone about yourself"
            />
          </section>

          {user?.is_dev && (
            <section>
              <div className="section-heading">
                <h4>Badges</h4>
                <p>Select icon badges for your profile.</p>
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
                      title={opt.title}
                    >
                      {Icon && <Icon size={16} />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          <button className="save-btn" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </main>
      </div>
    </div>
  );
}
