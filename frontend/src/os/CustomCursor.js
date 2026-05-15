import React, { useEffect, useRef, useState } from "react";

/**
 * Multi-style custom cursor.
 * mode: "none" | "dot" | "crosshair" | "glow" | "minimal"
 */
export default function CustomCursor({ mode = "dot" }) {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const target = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });

  useEffect(() => {
    if (mode === "none") return;

    const onMove = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      if (!visible) setVisible(true);
      const el = e.target;
      const interactive = !!(el.closest && el.closest("button, a, input, textarea, select, [role='button'], .nx-icon, .nx-dock-btn, .nx-win-btn, .nx-tab, .nx-color-opt, .nx-wall-item"));
      document.documentElement.classList.toggle("ax-cursor-hover", interactive);
      const isText = el.matches && el.matches("input, textarea, [contenteditable='true']");
      document.documentElement.classList.toggle("ax-cursor-text", !!isText);
    };
    const onLeave = () => setVisible(false);
    const onDown = () => document.documentElement.classList.add("ax-cursor-down");
    const onUp   = () => document.documentElement.classList.remove("ax-cursor-down");

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    let raf = 0;
    const tick = () => {
      ring.current.x += (target.current.x - ring.current.x) * 0.18;
      ring.current.y += (target.current.y - ring.current.y) * 0.18;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${target.current.x}px, ${target.current.y}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    document.documentElement.classList.add("ax-cursor-on");
    document.documentElement.dataset.cursorMode = mode;

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("ax-cursor-on", "ax-cursor-hover", "ax-cursor-text", "ax-cursor-down");
      delete document.documentElement.dataset.cursorMode;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (mode === "none") return null;

  return (
    <>
      <div
        ref={ringRef}
        className={`ax-cursor-ring ax-cursor-${mode}-ring`}
        style={{ opacity: visible ? 1 : 0 }}
        aria-hidden
      />
      <div
        ref={dotRef}
        className={`ax-cursor-dot ax-cursor-${mode}-dot`}
        style={{ opacity: visible ? 1 : 0 }}
        aria-hidden
      />
    </>
  );
}
