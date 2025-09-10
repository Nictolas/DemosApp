import React from "react";

interface SmallNoseStyleProps {
  skinColor: string;
}

export function SmallNoseStyle({ skinColor }: SmallNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO PICCOLO - CENTRATO E INGRANDITO */}
      <g transform="translate(150,150)">
        <path d="M -8 0 Q 0 8 8 0" stroke="#000" strokeWidth="4" fill="none" />
      </g>
    </svg>
  );
}
