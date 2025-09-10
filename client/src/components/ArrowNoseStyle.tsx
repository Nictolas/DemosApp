import React from "react";

interface ArrowNoseStyleProps {
  skinColor: string;
}

export function ArrowNoseStyle({ skinColor }: ArrowNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO A FRECCIA - CENTRATO E INGRANDITO */}
      <g transform="translate(150,150)">
        <path d="M 0 -10 L -10 0 L 0 10" stroke="#000" strokeWidth="6" fill="none" />
      </g>
    </svg>
  );
}
