// Installed apps registry (localStorage-backed).
// Each entry: { id, name, url, color, emoji, builtin?, installedAt, mode? }
//
// mode:
//   "direct"   — load URL directly (best UX when the site doesn't set X-Frame-Options)
//   "proxy"    — route through /api/proxy with full asset + fetch/XHR rewriting
//   "embed"    — service-specific embed URL (e.g. YouTube/Spotify player)
//   "fallback" — show "open in real browser" card (sites that block both direct and proxy)
//
// Default for custom URLs is "proxy".

const KEY = "astra-installed-apps";

export const CATALOG = [
  // Real apps — full web players via proxy (login-capable thanks to per-user cookie jar)
  { id: "spotify",   name: "Spotify",     url: "https://open.spotify.com",           color: "#1DB954", emoji: "♫",  desc: "Music streaming & podcasts. Log in for the full library.", mode: "proxy" },
  { id: "youtube",   name: "YouTube",     url: "https://www.youtube.com",            color: "#ff0033", emoji: "▶",  desc: "Watch & sign in for your subscriptions.",                   mode: "proxy" },

  // Direct-iframe (no X-Frame-Options) — fastest, most native experience
  { id: "wikipedia", name: "Wikipedia",   url: "https://en.wikipedia.org/wiki/Main_Page", color: "#000000", emoji: "𝓦",  desc: "The free encyclopedia.",          mode: "direct" },
  { id: "archive",   name: "Archive.org", url: "https://archive.org",                color: "#222222", emoji: "❉", desc: "Internet archive — books, audio, video.", mode: "direct" },
  { id: "hn",        name: "Hacker News", url: "https://news.ycombinator.com",       color: "#FF6600", emoji: "Y",  desc: "Tech news from the community.",         mode: "direct" },
  { id: "lobsters",  name: "Lobsters",    url: "https://lobste.rs",                  color: "#ac130d", emoji: "♨", desc: "Computing-focused tech link board.",     mode: "direct" },

  // Proxied — site sets X-Frame-Options but our proxy strips them + rewrites assets
  { id: "ddg",       name: "DuckDuckGo",  url: "https://duckduckgo.com",             color: "#DE5833", emoji: "🦆", desc: "Privacy-first search.",                 mode: "proxy" },
  { id: "mdn",       name: "MDN Docs",    url: "https://developer.mozilla.org",      color: "#005A9C", emoji: "📚", desc: "Web platform reference.",               mode: "proxy" },
  { id: "github",    name: "GitHub",      url: "https://github.com",                  color: "#24292f", emoji: "❮❯", desc: "Build and ship software.",              mode: "proxy" },
  { id: "openstreetmap", name: "Maps",    url: "https://www.openstreetmap.org",      color: "#7ebc6f", emoji: "🗺", desc: "OpenStreetMap — embeddable maps.",       mode: "proxy" },

  // Bot-walled / login-walled — proxy gets 403, direct gets X-Frame-Options. Show fallback.
  { id: "reddit",    name: "Reddit",      url: "https://www.reddit.com",             color: "#FF4500", emoji: "🅁", desc: "Front page of the internet.",            mode: "fallback" },
  { id: "community-chat",   name: "Community Chat", url: "https://community-chat.example.com", displayUrl: "community chat service", color: "#5865F2", emoji: "💬", desc: "Voice, video & chat for communities.", mode: "fallback" },
  { id: "chatgpt",   name: "ChatGPT",     url: "https://chat.openai.com",            color: "#10A37F", emoji: "✦",  desc: "OpenAI's AI assistant.",                mode: "fallback" },
  { id: "x",         name: "X",           url: "https://x.com",                       color: "#1d1d1f", emoji: "𝕏", desc: "What's happening, in real time.",       mode: "fallback" },
  { id: "twitch",    name: "Twitch",      url: "https://www.twitch.tv",              color: "#9146FF", emoji: "⌬",  desc: "Live streaming for gamers.",            mode: "fallback" },
  { id: "profilepicker", name: "Profile Picker", url: "app://profilepicker", color: "#5865F2", emoji: "👤", desc: "Launch the profile editor from the store.", builtin: true, launchId: "Profile" },
];

export function loadInstalled() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveInstalled(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100))); } catch (e) { /* ignore */ }
  window.dispatchEvent(new Event("astra-apps-updated"));
}

export function isInstalled(id) {
  return loadInstalled().some((a) => a.id === id);
}

export function installFromCatalog(catalogEntry) {
  const list = loadInstalled();
  if (list.some((a) => a.id === catalogEntry.id)) return list;
  const entry = {
    ...catalogEntry,
    installedAt: new Date().toISOString(),
  };
  list.unshift(entry);
  saveInstalled(list);
  return list;
}

export function installCustom({ name, url, emoji = "◇", color = "#6366f1" }) {
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const target = url.startsWith("http") ? url : `https://${url}`;
  const list = loadInstalled();
  // Custom URLs default to proxy mode (works for most sites that set X-Frame-Options).
  // The WebApp escalates to fallback automatically if proxy fails.
  const entry = { id, name, url: target, emoji, color, custom: true, mode: "proxy", installedAt: new Date().toISOString() };
  list.unshift(entry);
  saveInstalled(list);
  return entry;
}

export function uninstall(id) {
  const list = loadInstalled().filter((a) => a.id !== id);
  saveInstalled(list);
  return list;
}
