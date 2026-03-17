import React from "react";

interface ButtonNoseStyleProps {
  skinColor: string;
}

export function ButtonNoseStyle({ skinColor }: ButtonNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO A BOTTONE - CENTRATO E INGRANDITO ANCORA DI PIÙ */}
      <g transform="translate(150,150)">
        <circle cx="0" cy="0" r="30" fill={skinColor} stroke="#000" strokeWidth="15" />
      </g>
    </svg>
  );
}
