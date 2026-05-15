import React from "react";
import { Globe, Settings as SettingsIcon, FileText, TerminalSquare, Folder, Calculator as CalcIcon } from "lucide-react";

export const DESKTOP_ICONS = [
  { id: "Browser",    label: "BROWSER",   Icon: Globe,           x: 32,  y: 32  },
  { id: "Settings",   label: "SETTINGS",  Icon: SettingsIcon,    x: 32,  y: 130 },
  { id: "Notes",      label: "NOTES",     Icon: FileText,        x: 32,  y: 228 },
  { id: "Terminal",   label: "TERMINAL",  Icon: TerminalSquare,  x: 32,  y: 326 },
  { id: "Files",      label: "FILES",     Icon: Folder,          x: 32,  y: 424 },
  { id: "Calculator", label: "CALC",      Icon: CalcIcon,        x: 32,  y: 522 },
];

export default function Desktop({ onLaunch }) {
  return (
    <div className="nx-desktop" data-testid="desktop">
      {DESKTOP_ICONS.map((i) => (
        <div
          key={i.id}
          className="nx-icon"
          style={{ left: i.x, top: i.y }}
          onDoubleClick={() => onLaunch(i.id)}
          data-testid={`desktop-icon-${i.id}`}
        >
          <div className="nx-icon-box"><i.Icon size={22} strokeWidth={1.5} /></div>
          <div className="nx-icon-label">{i.label}</div>
        </div>
      ))}
    </div>
  );
}
