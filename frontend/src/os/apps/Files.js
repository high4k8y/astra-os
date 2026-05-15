import React, { useEffect, useState } from "react";
import { Folder, FileText, Image as ImageIcon, Music, Download as DownloadIcon, Trash2, ExternalLink } from "lucide-react";
import { loadDownloads, removeDownload, clearDownloads, downloadViaProxy } from "../downloads";

const SYSTEM_ITEMS = [
  { Icon: Folder, name: "Documents" },
  { Icon: Folder, name: "Pictures" },
  { Icon: Folder, name: "Music" },
  { Icon: Folder, name: "Videos" },
  { Icon: FileText, name: "readme.txt" },
  { Icon: ImageIcon, name: "photo.png" },
  { Icon: Music, name: "music.mp3" },
];

function fileIcon(type, name) {
  const t = (type || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return ImageIcon;
  if (t.startsWith("audio/") || /\.(mp3|wav|ogg|flac)$/.test(n)) return Music;
  return FileText;
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function Files() {
  const [downloads, setDownloads] = useState(loadDownloads);

  useEffect(() => {
    const refresh = () => setDownloads(loadDownloads());
    window.addEventListener("astra-downloads-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("astra-downloads-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const reDownload = async (entry) => {
    try { await downloadViaProxy(entry.url); }
    catch (e) { alert("Could not re-download: " + e.message); }
  };

  return (
    <div className="ax-files-app" data-testid="app-files">
      <div className="ax-files-section">
        <div className="ax-files-head">
          <span>Downloads</span>
          {downloads.length > 0 && (
            <button
              className="nx-small-btn"
              onClick={() => { if (window.confirm("Clear downloads list?")) clearDownloads(); }}
              data-testid="files-downloads-clear"
            >Clear</button>
          )}
        </div>
        {downloads.length === 0 ? (
          <div className="ax-files-empty" data-testid="files-downloads-empty">
            <DownloadIcon size={20} strokeWidth={1.4} />
            <span>No downloads yet — open Browser, visit a page, and click the download icon.</span>
          </div>
        ) : (
          <div className="ax-files-list" data-testid="files-downloads-list">
            {downloads.map((d) => {
              const Icon = fileIcon(d.type, d.name);
              return (
                <div className="ax-files-row" key={d.id} data-testid={`download-${d.name}`}>
                  <Icon size={20} strokeWidth={1.5} style={{ color: "var(--ax-text-dim)" }} />
                  <div className="ax-files-meta">
                    <div className="ax-files-name">{d.name}</div>
                    <div className="ax-files-sub">
                      {d.sizeLabel || "—"} · {fmtTime(d.ts)} · {d.url.replace(/^https?:\/\//, "").slice(0, 50)}
                    </div>
                  </div>
                  <button className="ax-files-iconbtn" title="Re-download" onClick={() => reDownload(d)} data-testid={`download-redo-${d.name}`}>
                    <DownloadIcon size={13} strokeWidth={1.7} />
                  </button>
                  <a className="ax-files-iconbtn" title="Open original" href={d.url} target="_blank" rel="noopener noreferrer" data-testid={`download-open-${d.name}`}>
                    <ExternalLink size={13} strokeWidth={1.7} />
                  </a>
                  <button className="ax-files-iconbtn" title="Remove" onClick={() => { setDownloads(removeDownload(d.id)); }} data-testid={`download-remove-${d.name}`}>
                    <Trash2 size={13} strokeWidth={1.7} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="ax-files-section">
        <div className="ax-files-head"><span>System</span></div>
        <div className="nx-files">
          {SYSTEM_ITEMS.map((f) => (
            <div className="nx-file" key={f.name} data-testid={`file-${f.name}`}>
              <div className="nx-file-icon"><f.Icon size={28} strokeWidth={1.4} /></div>
              <div className="nx-file-name">{f.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
