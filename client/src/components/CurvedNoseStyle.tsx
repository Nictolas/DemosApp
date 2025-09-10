import React from "react";

interface CurvedNoseStyleProps {
  skinColor: string;
}

export function CurvedNoseStyle({ skinColor }: CurvedNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO CURVO - CENTRATO E INGRANDITO */}
      <g transform="translate(150,150)">
        <path d="M -12 0 Q 0 15 12 0" stroke="#000" strokeWidth="6" fill="none" />
      </g>
    </svg>
  );
}
