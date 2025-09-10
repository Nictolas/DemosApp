import React from "react";

interface LargeNoseStyleProps {
  skinColor: string;
}

export function LargeNoseStyle({ skinColor }: LargeNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO GRANDE - CENTRATO E INGRANDITO TANTISSIMO */}
      <g transform="translate(150,150)">
        <path d="M -30 0 Q 0 30 30 0" stroke="#000" strokeWidth="15" fill="none" />
      </g>
    </svg>
  );
}
