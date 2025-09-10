import React from "react";

interface ButtonNoseStyleProps {
  skinColor: string;
}

export function ButtonNoseStyle({ skinColor }: ButtonNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO A BOTTONE - CENTRATO E INGRANDITO TANTISSIMO */}
      <g transform="translate(150,150)">
        <circle cx="0" cy="0" r="18" fill={skinColor} stroke="#000" strokeWidth="8" />
      </g>
    </svg>
  );
}
