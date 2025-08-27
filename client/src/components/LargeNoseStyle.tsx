import React from "react";

interface LargeNoseStyleProps {
  skinColor: string;
}

export function LargeNoseStyle({ skinColor }: LargeNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO GRANDE VISIBILE NEL SELETTORE */}
      <g transform="translate(150,150) scale(0.8,0.8)">
        <path d="M 145 132 Q 150 142 155 132" stroke="#000" strokeWidth="8" fill="none" />
      </g>
    </svg>
  );
}
