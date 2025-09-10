import React from "react";

interface BroadNoseStyleProps {
  skinColor: string;
}

export function BroadNoseStyle({ skinColor }: BroadNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO LARGO - CENTRATO E INGRANDITO TANTISSIMO */}
      <g transform="translate(150,150)">
        <path d="M -30 0 Q 0 20 30 0" stroke="#000" strokeWidth="12" fill="none" />
      </g>
    </svg>
  );
}
