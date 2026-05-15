import React, { useEffect, useRef } from "react";

/**
 * Custom cursor with selectable styles.
 * mode: "system" | "dot" | "crosshair" | "glow" | "minimal" | "ring"
 * "system" → no custom cursor; the default OS pointer is used.
 */
export default function CustomCursor({ mode = "dot" }) {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const target = useRef({ x: -200, y: -200 });
  const ring = useRef({ x: -200, y: -200 });

  useEffect(() => {
    // Always start clean
    document.documentElement.classList.remove(
      "ax-cursor-on", "ax-cursor-hover", "ax-cursor-text", "ax-cursor-down"
    );
    document.documentElement.removeAttribute("data-cursor-mode");

    if (mode === "system" || mode === "none") return;

    const onMove = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      const el = e.target;
      const interactive = !!(el && el.closest && el.closest(
        "button, a, input, textarea, select, [role='button'], .nx-icon, .nx-dock-btn, .nx-win-btn, .nx-tab, .nx-color-opt, .nx-wall-item, .ax-pick, .ax-chip"
      ));
      document.documentElement.classList.toggle("ax-cursor-hover", interactive);
      const isText = el && el.matches && el.matches("input, textarea, [contenteditable='true']");
      document.documentElement.classList.toggle("ax-cursor-text", !!isText);
    };
    const onDown = () => document.documentElement.classList.add("ax-cursor-down");
    const onUp = () => document.documentElement.classList.remove("ax-cursor-down");

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    let raf = 0;
    const tick = () => {
      ring.current.x += (target.current.x - ring.current.x) * 0.2;
      ring.current.y += (target.current.y - ring.current.y) * 0.2;
      if (dotRef.current) {
        dotRef.current.style.transform =
          `translate3d(${target.current.x}px, ${target.current.y}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform =
          `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    document.documentElement.classList.add("ax-cursor-on");
    document.documentElement.setAttribute("data-cursor-mode", mode);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove(
        "ax-cursor-on", "ax-cursor-hover", "ax-cursor-text", "ax-cursor-down"
      );
      document.documentElement.removeAttribute("data-cursor-mode");
    };
  }, [mode]);

  if (mode === "system" || mode === "none") return null;

  return (
    <>
      <div ref={ringRef} className="ax-cursor-ring" aria-hidden />
      <div ref={dotRef} className="ax-cursor-dot" aria-hidden />
    </>
  );
}
