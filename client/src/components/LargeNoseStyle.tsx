import React from "react";

interface LargeNoseStyleProps {
  skinColor: string;
}

export function LargeNoseStyle({ skinColor }: LargeNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO GRANDE - PATH ESATTO DELL'ANTEPRIMA AVATAR - SPOSTATO MOLTO PIÙ IN ALTO E A SINISTRA */}
      <g transform="translate(120,120) scale(0.8,0.8)">
        <path d="M 145 132 Q 150 142 155 132" stroke="#000" strokeWidth="10" fill="none" />
      </g>
    </svg>
  );
}
