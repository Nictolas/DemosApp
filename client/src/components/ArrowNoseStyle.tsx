import React from "react";

interface ArrowNoseStyleProps {
  skinColor: string;
}

export function ArrowNoseStyle({ skinColor }: ArrowNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO A FRECCIA - CENTRATO NEL PULSANTE */}
      <g transform="translate(150,150)">
        <path d="M 0 -5 L -5 0 L 0 5" stroke="#000" strokeWidth="3" fill="none" />
      </g>
    </svg>
  );
}
