import React from "react";

interface PointedNoseStyleProps {
  skinColor: string;
}

export function PointedNoseStyle({ skinColor }: PointedNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO APPUNTITO - CENTRATO NEL PULSANTE */}
      <g transform="translate(150,150)">
        <path d="M -3 -2 L 0 5 L 3 -2" stroke="#000" strokeWidth="3" fill="none" />
      </g>
    </svg>
  );
}
