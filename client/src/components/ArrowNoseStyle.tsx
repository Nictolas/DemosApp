import React from "react";

interface ArrowNoseStyleProps {
  skinColor: string;
}

export function ArrowNoseStyle({ skinColor }: ArrowNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO A FRECCIA - CENTRATO E INGRANDITO TANTISSIMO */}
      <g transform="translate(150,150)">
        <path d="M 0 -25 L -25 0 L 0 25" stroke="#000" strokeWidth="12" fill="none" />
      </g>
    </svg>
  );
}
