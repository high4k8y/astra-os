// Downloads — localStorage-backed download manager + helper
const KEY = "astra-downloads";

export function loadDownloads() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveDownloads(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200))); } catch (e) { /* ignore */ }
}

export function addDownload(entry) {
  const list = loadDownloads();
  list.unshift({ ...entry, id: `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` });
  saveDownloads(list);
  window.dispatchEvent(new Event("astra-downloads-updated"));
  return list;
}

export function removeDownload(id) {
  const list = loadDownloads().filter((d) => d.id !== id);
  saveDownloads(list);
  window.dispatchEvent(new Event("astra-downloads-updated"));
  return list;
}

export function clearDownloads() {
  saveDownloads([]);
  window.dispatchEvent(new Event("astra-downloads-updated"));
}

const PROXY = `${process.env.REACT_APP_BACKEND_URL || ""}/api/proxy?url=`;

function guessFilename(url, contentType) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last && last.includes(".")) return decodeURIComponent(last);
    const host = u.hostname.replace(/^www\./, "");
    const ext = (contentType || "").includes("html") ? "html"
      : (contentType || "").includes("json") ? "json"
      : (contentType || "").includes("pdf")  ? "pdf"
      : (contentType || "").includes("image/png")  ? "png"
      : (contentType || "").includes("image/jpeg") ? "jpg"
      : "txt";
    return `${host || "page"}.${ext}`;
  } catch {
    return "file.txt";
  }
}

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
}

/**
 * Download a URL via the backend proxy and save to disk + register in Downloads list.
 */
export async function downloadViaProxy(url) {
  if (!url) return;
  const target = url.startsWith("http") ? url : `https://${url}`;
  const resp = await fetch(PROXY + encodeURIComponent(target));
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  const ct = resp.headers.get("content-type") || blob.type || "application/octet-stream";
  const name = guessFilename(target, ct);

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);

  addDownload({
    name,
    url: target,
    size: blob.size,
    sizeLabel: fmtSize(blob.size),
    type: ct,
    ts: new Date().toISOString(),
  });

  return { name, size: blob.size, type: ct };
}
