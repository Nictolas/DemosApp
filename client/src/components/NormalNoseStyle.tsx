import React from "react";

interface NormalNoseStyleProps {
  skinColor: string;
}

export function NormalNoseStyle({ skinColor }: NormalNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO NORMALE - CENTRATO NEL PULSANTE */}
      <g transform="translate(150,150)">
        <path d="M -5 0 Q 0 5 5 0" stroke="#000" strokeWidth="3" fill="none" />
      </g>
    </svg>
  );
}
