import React from "react";

interface CurvedNoseStyleProps {
  skinColor: string;
}

export function CurvedNoseStyle({ skinColor }: CurvedNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO CURVO - CENTRATO E INGRANDITO TANTISSIMO */}
      <g transform="translate(150,150)">
        <path d="M -25 0 Q 0 30 25 0" stroke="#000" strokeWidth="12" fill="none" />
      </g>
    </svg>
  );
}
