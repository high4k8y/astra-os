import React, { useEffect, useRef, useState } from "react";
import { Eraser, Trash2, Download } from "lucide-react";

const COLORS = ["#ffffff", "#f43f5e", "#fb923c", "#fbbf24", "#22c55e", "#06b6d4", "#6366f1", "#a855f7"];
const SIZES = [2, 4, 8, 14];

export default function Paint() {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [color, setColor] = useState("#a5b4fc");
  const [size, setSize] = useState(4);
  const [erase, setErase] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const data = c.getContext("2d").getImageData(0, 0, c.width || 1, c.height || 1);
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      const ctx = c.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#0a0b10";
      ctx.fillRect(0, 0, rect.width, rect.height);
      try { ctx.putImageData(data, 0, 0); } catch (e) { /* size mismatch on first resize */ }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const pos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e) => { drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    const p = pos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = erase ? "#0a0b10" : color;
    ctx.lineWidth = erase ? size * 2 : size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => { drawing.current = false; last.current = null; };

  const clearAll = () => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0a0b10";
    const r = c.getBoundingClientRect();
    ctx.fillRect(0, 0, r.width, r.height);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = `astra-paint-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="ax-paint" data-testid="app-paint">
      <div className="ax-paint-tools">
        <div className="ax-paint-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`ax-paint-color ${!erase && color === c ? "active" : ""}`}
              style={{ background: c }}
              onClick={() => { setColor(c); setErase(false); }}
              data-testid={`paint-color-${c.replace("#", "")}`}
              aria-label={`color ${c}`}
            />
          ))}
        </div>
        <div className="ax-paint-divider" />
        <div className="ax-paint-sizes">
          {SIZES.map((s) => (
            <button
              key={s}
              className={`ax-paint-size ${size === s ? "active" : ""}`}
              onClick={() => setSize(s)}
              data-testid={`paint-size-${s}`}
              aria-label={`size ${s}`}
            >
              <span style={{ width: s + 2, height: s + 2, background: "currentColor", borderRadius: "50%" }} />
            </button>
          ))}
        </div>
        <div className="ax-paint-divider" />
        <button
          className={`ax-paint-tool ${erase ? "active" : ""}`}
          onClick={() => setErase((v) => !v)}
          data-testid="paint-erase"
          title="Eraser"
        ><Eraser size={14} strokeWidth={1.7} /></button>
        <button className="ax-paint-tool" onClick={clearAll} data-testid="paint-clear" title="Clear">
          <Trash2 size={14} strokeWidth={1.7} />
        </button>
        <button className="ax-paint-tool" onClick={download} data-testid="paint-download" title="Download PNG">
          <Download size={14} strokeWidth={1.7} />
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="ax-paint-canvas"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        data-testid="paint-canvas"
      />
    </div>
  );
}
