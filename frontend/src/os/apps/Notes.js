import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

const KEY = "astra-notes";

export default function Notes() {
  const [text, setText] = useState(() => localStorage.getItem(KEY) || "");
  const [status, setStatus] = useState("Ready");
  const t = useRef(null);

  useEffect(() => () => clearTimeout(t.current), []);

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    localStorage.setItem(KEY, v);
    setStatus("Saved");
    clearTimeout(t.current);
    t.current = setTimeout(() => setStatus("Ready"), 900);
  };

  const clear = () => {
    if (window.confirm("Clear all notes? This cannot be undone.")) {
      setText("");
      localStorage.removeItem(KEY);
      setStatus("Cleared");
      clearTimeout(t.current);
      t.current = setTimeout(() => setStatus("Ready"), 900);
    }
  };

  return (
    <div className="nx-notes" data-testid="app-notes">
      <div className="nx-notes-caution" data-testid="notes-caution">
        <AlertTriangle size={14} strokeWidth={1.8} />
        <span>
          <strong>Heads up:</strong> notes are stored only on this device.
          Clearing your browser data, switching browsers, or using private mode will erase them — back up anything important.
        </span>
      </div>
      <div className="nx-notes-tools">
        <div
          className={`nx-notes-status ${status === "Saved" ? "saved" : ""}`}
          data-testid="notes-status"
        >
          {status === "Saved" ? "✓ Saved" : status}
        </div>
        <button className="nx-small-btn" onClick={clear} data-testid="notes-clear">Clear all</button>
      </div>
      <textarea
        className="nx-notes-area"
        value={text}
        onChange={onChange}
        placeholder="Start typing…&#10;&#10;Notes auto-save to this device."
        data-testid="notes-area"
      />
    </div>
  );
}
