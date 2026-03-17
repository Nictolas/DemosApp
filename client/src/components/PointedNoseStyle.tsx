import React from "react";

interface PointedNoseStyleProps {
  skinColor: string;
}

export function PointedNoseStyle({ skinColor }: PointedNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO APPUNTITO - CENTRATO E INGRANDITO ANCORA DI PIÙ */}
      <g transform="translate(150,150)">
        <path d="M -35 -20 L 0 40 L 35 -20" stroke="#000" strokeWidth="20" fill="none" />
      </g>
    </svg>
  );
}
