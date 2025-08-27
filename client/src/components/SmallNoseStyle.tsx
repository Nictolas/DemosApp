import React from "react";

interface SmallNoseStyleProps {
  skinColor: string;
}

export function SmallNoseStyle({ skinColor }: SmallNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO PICCOLO VISIBILE NEL SELETTORE */}
      <g transform="translate(150,150) scale(0.8,0.8)">
        <path d="M 148 135 Q 150 138 152 135" stroke="#000" strokeWidth="8" fill="none" />
      </g>
    </svg>
  );
}
