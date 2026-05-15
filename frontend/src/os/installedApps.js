// Installed apps registry (localStorage-backed).
// Each entry: { id, name, url, color, emoji, builtin?, installedAt }

const KEY = "astra-installed-apps";

export const CATALOG = [
  { id: "discord",   name: "Discord",   url: "https://discord.com/app",            color: "#5865F2", emoji: "💬", desc: "Voice, video & chat for communities." },
  { id: "youtube",   name: "YouTube",   url: "https://www.youtube.com",            color: "#ff0033", emoji: "▶",  desc: "Watch the world's videos." },
  { id: "spotify",   name: "Spotify",   url: "https://open.spotify.com",           color: "#1DB954", emoji: "♫",  desc: "Music streaming & podcasts." },
  { id: "chatgpt",   name: "ChatGPT",   url: "https://chat.openai.com",            color: "#10A37F", emoji: "✦",  desc: "OpenAI's AI assistant." },
  { id: "x",         name: "X",         url: "https://x.com",                       color: "#1d1d1f", emoji: "𝕏", desc: "What's happening, in real time." },
  { id: "reddit",    name: "Reddit",    url: "https://www.reddit.com",             color: "#FF4500", emoji: "🅁",  desc: "Front page of the internet." },
  { id: "github",    name: "GitHub",    url: "https://github.com",                  color: "#24292f", emoji: "❮❯", desc: "Build and ship software." },
  { id: "wikipedia", name: "Wikipedia", url: "https://en.wikipedia.org",            color: "#000000", emoji: "𝓦",  desc: "The free encyclopedia." },
  { id: "twitch",    name: "Twitch",    url: "https://www.twitch.tv",              color: "#9146FF", emoji: "⌬",  desc: "Live streaming for gamers." },
  { id: "ddg",       name: "DuckDuckGo", url: "https://html.duckduckgo.com/html",  color: "#DE5833", emoji: "🦆", desc: "Privacy-first search." },
  { id: "hn",        name: "Hacker News", url: "https://news.ycombinator.com",     color: "#FF6600", emoji: "Y",  desc: "Tech news from the community." },
  { id: "mdn",       name: "MDN Web Docs", url: "https://developer.mozilla.org",   color: "#005A9C", emoji: "📚", desc: "Web platform reference." },
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
  const entry = { id, name, url: target, emoji, color, custom: true, installedAt: new Date().toISOString() };
  list.unshift(entry);
  saveInstalled(list);
  return entry;
}

export function uninstall(id) {
  const list = loadInstalled().filter((a) => a.id !== id);
  saveInstalled(list);
  return list;
}
