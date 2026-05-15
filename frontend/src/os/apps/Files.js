import React from "react";
import { Folder, FileText, Image as ImageIcon, Music } from "lucide-react";

const ITEMS = [
  { Icon: Folder, name: "Documents" },
  { Icon: Folder, name: "Downloads" },
  { Icon: Folder, name: "Pictures" },
  { Icon: Folder, name: "Music" },
  { Icon: Folder, name: "Videos" },
  { Icon: FileText, name: "readme.txt" },
  { Icon: ImageIcon, name: "photo.png" },
  { Icon: Music, name: "music.mp3" },
];

export default function Files() {
  return (
    <div className="nx-files" data-testid="app-files">
      {ITEMS.map((f) => (
        <div className="nx-file" key={f.name} data-testid={`file-${f.name}`}>
          <div className="nx-file-icon"><f.Icon size={28} strokeWidth={1.4} /></div>
          <div className="nx-file-name">{f.name}</div>
        </div>
      ))}
    </div>
  );
}
