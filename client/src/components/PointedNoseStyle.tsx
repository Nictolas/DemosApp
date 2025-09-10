import React from "react";

interface PointedNoseStyleProps {
  skinColor: string;
}

export function PointedNoseStyle({ skinColor }: PointedNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO APPUNTITO - CENTRATO E INGRANDITO */}
      <g transform="translate(150,150)">
        <path d="M -8 -5 L 0 10 L 8 -5" stroke="#000" strokeWidth="6" fill="none" />
      </g>
    </svg>
  );
}
