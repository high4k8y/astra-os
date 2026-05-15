import React, { useEffect, useState, useRef } from "react";

/**
 * Custom cursor — replaces the system cursor with a sleek dot + ring.
 * Hidden on touch devices automatically (no mousemove events).
 * Toggleable via settings.cursor.
 */
export default function CustomCursor({ enabled }) {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const target = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      if (!visible) setVisible(true);
      // detect if hovering interactive element
      const el = e.target;
      const interactive = !!(el.closest("button, a, input, textarea, select, [role='button'], .nx-icon, .nx-dock-btn, .nx-win-btn, .nx-tab, .nx-color-opt, .nx-wall-item"));
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
      // dot follows immediately, ring lerps for trail effect
      ring.current.x += (target.current.x - ring.current.x) * 0.18;
      ring.current.y += (target.current.y - ring.current.y) * 0.18;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${target.current.x - 3}px, ${target.current.y - 3}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.current.x - 14}px, ${ring.current.y - 14}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    document.documentElement.classList.add("ax-cursor-on");

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("ax-cursor-on", "ax-cursor-hover", "ax-cursor-text", "ax-cursor-down");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      <div
        ref={ringRef}
        className="ax-cursor-ring"
        style={{ opacity: visible ? 1 : 0 }}
        aria-hidden
      />
      <div
        ref={dotRef}
        className="ax-cursor-dot"
        style={{ opacity: visible ? 1 : 0 }}
        aria-hidden
      />
    </>
  );
}
