// Generates a stable-ish client device fingerprint for Astra OS.
// Combines persistent UUID + Canvas + screen + UA + timezone + language.
// Cached in localStorage so it survives reloads but can be cleared.

const KEY = "astra-device-fp";

async function digest(s) {
  try {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      const enc = new TextEncoder().encode(s);
      const buf = await window.crypto.subtle.digest("SHA-256", enc);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch { /* ignore */ }
  // Fallback: 32-bit hash (good enough to be a stable ID)
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8).repeat(8);
}

function canvasSig() {
  try {
    const c = document.createElement("canvas");
    c.width = 220; c.height = 36;
    const x = c.getContext("2d");
    x.textBaseline = "top";
    x.font = "14px 'Arial'";
    x.fillStyle = "#f43f5e"; x.fillRect(0, 0, 220, 36);
    x.fillStyle = "#0ea5e9"; x.fillText("Astra-OS · fingerprint · 2026", 2, 2);
    x.strokeStyle = "#10b981"; x.beginPath();
    x.arc(60, 18, 12, 0, Math.PI * 2); x.stroke();
    return c.toDataURL().slice(-256);
  } catch { return "no-canvas"; }
}

function rawSeed() {
  const n = typeof navigator !== "undefined" ? navigator : {};
  const s = typeof screen !== "undefined" ? screen : {};
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } })();
  return [
    n.userAgent || "",
    n.platform || "",
    n.language || "",
    (n.languages || []).join(","),
    n.hardwareConcurrency || "",
    n.deviceMemory || "",
    s.width + "x" + s.height + "@" + (s.colorDepth || 24),
    tz,
    canvasSig(),
  ].join("|");
}

export async function getFingerprint() {
  try {
    const cached = localStorage.getItem(KEY);
    if (cached && /^[0-9a-f]{32,}$/i.test(cached)) return cached;
  } catch { /* ignore */ }
  const seed = rawSeed();
  let stableId;
  try {
    stableId = localStorage.getItem(KEY + ":id") || "";
  } catch { stableId = ""; }
  if (!stableId) {
    stableId = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : ("astra-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
    try { localStorage.setItem(KEY + ":id", stableId); } catch { /* ignore */ }
  }
  const fp = await digest(stableId + "::" + seed);
  try { localStorage.setItem(KEY, fp); } catch { /* ignore */ }
  return fp;
}
