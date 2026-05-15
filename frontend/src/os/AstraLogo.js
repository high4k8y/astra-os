import React from "react";

/**
 * Astra OS Logo — synthesized "A" with orbit ring + sparkle motif.
 * Inspired by the user's reference sheet (10 variants — common motif kept).
 */
export default function AstraLogo({ size = 88, glow = true, accent }) {
  const stroke = "url(#astra-grad)";
  return (
    <svg
      width={size} height={size} viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", filter: glow ? "drop-shadow(0 0 22px rgba(99,102,241,0.45))" : "none" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="astra-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={accent || "#a5b4fc"} />
          <stop offset="55%" stopColor={accent || "#6366f1"} />
          <stop offset="100%" stopColor={accent || "#3730a3"} />
        </linearGradient>
        <linearGradient id="astra-ring" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={accent || "#a5b4fc"} stopOpacity="0.1" />
          <stop offset="50%" stopColor={accent || "#818cf8"} stopOpacity="0.95" />
          <stop offset="100%" stopColor={accent || "#a5b4fc"} stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="astra-spark">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor={accent || "#c7d2fe"} stopOpacity="0.85" />
          <stop offset="100%" stopColor={accent || "#6366f1"} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* "A" — clean strokes */}
      <path
        d="M 100 28 L 158 168 M 100 28 L 42 168 M 65 130 L 135 130"
        fill="none" stroke={stroke}
        strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
      />

      {/* Orbit ring */}
      <ellipse
        cx="100" cy="112" rx="72" ry="22"
        fill="none" stroke="url(#astra-ring)" strokeWidth="2.4"
        transform="rotate(-18 100 112)"
      />

      {/* Sparkle inside the A */}
      <circle cx="100" cy="92" r="22" fill="url(#astra-spark)" />
      <g stroke="#ffffff" strokeLinecap="round" strokeWidth="1.6" opacity="0.9">
        <line x1="100" y1="80" x2="100" y2="104" />
        <line x1="88" y1="92" x2="112" y2="92" />
      </g>
      <circle cx="100" cy="92" r="2.6" fill="#ffffff" />
    </svg>
  );
}
