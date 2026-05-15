import React, { useRef, useState } from "react";
import { Minus, X } from "lucide-react";

export default function Window({
  id, title, x = 200, y = 100, w = 720, h = 480, z, onFocus, onClose, onMinimize, children,
}) {
  const [pos, setPos] = useState({ x, y });
  const drag = useRef(null);

  const onMouseDown = (e) => {
    if (e.target.closest(".nx-win-btn")) return;
    onFocus();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    const move = (ev) => {
      if (!drag.current) return;
      const dx = ev.clientX - drag.current.sx;
      const dy = ev.clientY - drag.current.sy;
      setPos({
        x: Math.max(-w + 80, Math.min(window.innerWidth - 80, drag.current.ox + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 80, drag.current.oy + dy)),
      });
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      className="nx-window"
      data-testid={`window-${id}`}
      style={{ left: pos.x, top: pos.y, width: w, height: h, zIndex: z }}
      onMouseDown={onFocus}
    >
      <div className="nx-win-head" onMouseDown={onMouseDown} data-testid={`window-head-${id}`}>
        <div className="nx-win-traffic" aria-hidden>
          <span className="t-close" />
          <span className="t-min" />
          <span className="t-max" />
        </div>
        <div className="nx-win-title">{title}</div>
        <div className="nx-win-ctrls">
          <button className="nx-win-btn" onClick={onMinimize} data-testid={`btn-minimize-${id}`} title="Minimize">
            <Minus size={14} strokeWidth={2} />
          </button>
          <button className="nx-win-btn close" onClick={onClose} data-testid={`btn-close-${id}`} title="Close">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="nx-win-body">{children}</div>
    </div>
  );
}
