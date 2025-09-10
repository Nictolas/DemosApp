import React from "react";

interface NoneGlassesStyleProps {
  // Nessuna prop necessaria per "nessun occhiale"
}

export function NoneGlassesStyle({}: NoneGlassesStyleProps) {
  return (
    <svg className="w-48 h-48" viewBox="0 0 300 300" fill="currentColor">
      {/* NESSUN OCCHIALE - X ICON */}
      <g transform="translate(138,138)">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="#9CA3AF"/>
      </g>
    </svg>
  );
}
