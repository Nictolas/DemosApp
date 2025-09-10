import React from "react";

interface BroadNoseStyleProps {
  skinColor: string;
}

export function BroadNoseStyle({ skinColor }: BroadNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO LARGO - CENTRATO E INGRANDITO */}
      <g transform="translate(150,150)">
        <path d="M -15 0 Q 0 10 15 0" stroke="#000" strokeWidth="6" fill="none" />
      </g>
    </svg>
  );
}
