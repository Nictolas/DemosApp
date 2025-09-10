import React from "react";

interface NoneGlassesStyleProps {
  // Nessuna prop necessaria per "nessun occhiale"
}

export function NoneGlassesStyle({}: NoneGlassesStyleProps) {
  return (
    <svg className="w-full h-full" viewBox="0 0 300 300" fill="currentColor">
      {/* NESSUN OCCHIALE - X ICON INGRANDITA */}
      <g transform="translate(100,100)">
        <path d="M50 15L42.5 7.5 25 25 7.5 7.5 0 15 17.5 32.5 0 50 7.5 57.5 25 40 42.5 57.5 50 50 32.5 32.5z" fill="#9CA3AF" stroke="#9CA3AF" strokeWidth="2"/>
      </g>
    </svg>
  );
}
