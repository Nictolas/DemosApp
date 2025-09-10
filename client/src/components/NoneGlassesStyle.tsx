import React from "react";

interface NoneGlassesStyleProps {
  // Nessuna prop necessaria per "nessun occhiale"
}

export function NoneGlassesStyle({}: NoneGlassesStyleProps) {
  return (
    <svg className="w-full h-full" viewBox="0 0 300 300" fill="currentColor">
      {/* NESSUN OCCHIALE - X ICON CENTRATA */}
      <g transform="translate(150,150)">
        <path d="M25 0L15 10L5 0L0 5L10 15L0 25L5 30L15 20L25 30L30 25L20 15L30 5L25 0z" fill="#9CA3AF" stroke="#9CA3AF" strokeWidth="2"/>
      </g>
    </svg>
  );
}
