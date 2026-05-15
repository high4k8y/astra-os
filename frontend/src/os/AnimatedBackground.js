import React, { useEffect, useRef } from "react";

/**
 * Animated backgrounds rendered behind the desktop.
 * mode: "none" | "aurora" | "stars" | "grid" | "waves"
 */
export default function AnimatedBackground({ mode = "none" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (mode !== "stars") return;
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let raf = 0;
    let stars = [];
    const reset = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      const count = Math.floor((window.innerWidth * window.innerHeight) / 6000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.4 + 0.2,
        a: Math.random(),
        s: 0.002 + Math.random() * 0.006,
        d: Math.random() < 0.5 ? 1 : -1,
      }));
    };
    reset();
    window.addEventListener("resize", reset);

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const st of stars) {
        st.a += st.s * st.d;
        if (st.a >= 1) { st.a = 1; st.d = -1; }
        if (st.a <= 0.1) { st.a = 0.1; st.d = 1; }
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${st.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", reset);
    };
  }, [mode]);

  if (mode === "none") return null;

  if (mode === "aurora") {
    return (
      <div className="ax-bg ax-bg-aurora" data-testid="bg-aurora" aria-hidden>
        <span className="ax-bg-blob a" />
        <span className="ax-bg-blob b" />
        <span className="ax-bg-blob c" />
      </div>
    );
  }

  if (mode === "grid") {
    return <div className="ax-bg ax-bg-grid" data-testid="bg-grid" aria-hidden />;
  }

  if (mode === "waves") {
    return (
      <div className="ax-bg ax-bg-waves" data-testid="bg-waves" aria-hidden>
        <svg viewBox="0 0 1440 800" preserveAspectRatio="none" width="100%" height="100%">
          <defs>
            <linearGradient id="ax-wave-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(99,102,241,0.45)" />
              <stop offset="100%" stopColor="rgba(168,85,247,0.15)" />
            </linearGradient>
          </defs>
          <path className="w1" fill="url(#ax-wave-grad)"
            d="M0,520 C300,420 480,620 720,520 C960,420 1140,620 1440,520 L1440,800 L0,800 Z" />
          <path className="w2" fill="rgba(99,102,241,0.20)"
            d="M0,600 C300,500 480,700 720,600 C960,500 1140,700 1440,600 L1440,800 L0,800 Z" />
          <path className="w3" fill="rgba(255,255,255,0.06)"
            d="M0,680 C300,580 480,780 720,680 C960,580 1140,780 1440,680 L1440,800 L0,800 Z" />
        </svg>
      </div>
    );
  }

  // stars
  return <canvas ref={ref} className="ax-bg ax-bg-stars" data-testid="bg-stars" aria-hidden />;
}
