import React from "react";

interface NoneGlassesStyleProps {
  // Nessuna prop necessaria per "nessun occhiale"
}

export function NoneGlassesStyle({}: NoneGlassesStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NESSUN OCCHIALE - X ICON */}
      <g transform="translate(120,120) scale(0.8,0.8)">
        <path
          d="M0 0 L20 20 M20 0 L0 20"
          stroke="#000"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
