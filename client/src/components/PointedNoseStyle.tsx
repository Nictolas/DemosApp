import React from "react";

interface PointedNoseStyleProps {
  skinColor: string;
}

export function PointedNoseStyle({ skinColor }: PointedNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO APPUNTITO VISIBILE NEL SELETTORE */}
      <g transform="translate(150,150) scale(0.8,0.8)">
        <path d="M 148 133 L 150 140 L 152 133" stroke="#000" strokeWidth="8" fill="none" />
      </g>
    </svg>
  );
}
