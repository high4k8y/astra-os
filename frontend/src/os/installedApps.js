// Installed apps registry (localStorage-backed).
// Each entry: { id, name, url, color, emoji, builtin?, installedAt, mode? }
//
// mode controls how the app is rendered on the OS:
//   "direct"   — load URL directly in an iframe (works for sites without X-Frame-Options)
//   "proxy"    — route through /api/proxy (default; rewrites links)
//   "embed"    — use a service-specific embed URL (e.g. YouTube/Spotify player)
//   "fallback" — never iframe; show the "open in real browser" card immediately

const KEY = "astra-installed-apps";

export const CATALOG = [
  { id: "youtube",   name: "YouTube",     url: "https://www.youtube.com",            color: "#ff0033", emoji: "▶",  desc: "Watch the world's videos.",            mode: "embed",   embed: "https://www.youtube-nocookie.com/embed?listType=user_uploads&list=trending" },
  { id: "spotify",   name: "Spotify",     url: "https://open.spotify.com",           color: "#1DB954", emoji: "♫",  desc: "Music streaming & podcasts.",          mode: "embed",   embed: "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0" },
  { id: "wikipedia", name: "Wikipedia",   url: "https://en.wikipedia.org/wiki/Main_Page", color: "#000000", emoji: "𝓦",  desc: "The free encyclopedia.",          mode: "direct" },
  { id: "ddg",       name: "DuckDuckGo",  url: "https://duckduckgo.com",             color: "#DE5833", emoji: "🦆", desc: "Privacy-first search.",                 mode: "direct" },
  { id: "hn",        name: "Hacker News", url: "https://news.ycombinator.com",       color: "#FF6600", emoji: "Y",  desc: "Tech news from the community.",         mode: "proxy" },
  { id: "mdn",       name: "MDN Docs",    url: "https://developer.mozilla.org",      color: "#005A9C", emoji: "📚", desc: "Web platform reference.",               mode: "proxy" },
  { id: "lobsters",  name: "Lobsters",    url: "https://lobste.rs",                  color: "#ac130d", emoji: "♨", desc: "Computing-focused tech link board.",     mode: "direct" },
  { id: "openstreetmap", name: "Maps",    url: "https://www.openstreetmap.org",      color: "#7ebc6f", emoji: "🗺", desc: "OpenStreetMap — embeddable maps.",       mode: "direct" },
  { id: "archive",   name: "Archive.org", url: "https://archive.org",                color: "#222222", emoji: "❉", desc: "Internet archive — books, audio, video.", mode: "direct" },
  { id: "discord",   name: "Discord",     url: "https://discord.com/app",            color: "#5865F2", emoji: "💬", desc: "Voice, video & chat for communities.", mode: "fallback" },
  { id: "chatgpt",   name: "ChatGPT",     url: "https://chat.openai.com",            color: "#10A37F", emoji: "✦",  desc: "OpenAI's AI assistant.",                mode: "fallback" },
  { id: "x",         name: "X",           url: "https://x.com",                       color: "#1d1d1f", emoji: "𝕏", desc: "What's happening, in real time.",       mode: "fallback" },
  { id: "github",    name: "GitHub",      url: "https://github.com",                  color: "#24292f", emoji: "❮❯", desc: "Build and ship software.",              mode: "proxy" },
  { id: "twitch",    name: "Twitch",      url: "https://www.twitch.tv",              color: "#9146FF", emoji: "⌬",  desc: "Live streaming for gamers.",            mode: "fallback" },
  { id: "reddit",    name: "Reddit",      url: "https://www.reddit.com",             color: "#FF4500", emoji: "🅁", desc: "Front page of the internet.",            mode: "fallback" },
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
  const entry = { id, name, url: target, emoji, color, custom: true, mode: "auto", installedAt: new Date().toISOString() };
  list.unshift(entry);
  saveInstalled(list);
  return entry;
}

export function uninstall(id) {
  const list = loadInstalled().filter((a) => a.id !== id);
  saveInstalled(list);
  return list;
}
