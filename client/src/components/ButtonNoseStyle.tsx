import React from "react";

interface ButtonNoseStyleProps {
  skinColor: string;
}

export function ButtonNoseStyle({ skinColor }: ButtonNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO A BOTTONE - PATH ESATTO DELL'ANTEPRIMA AVATAR - SPOSTATO MOLTO PIÙ IN ALTO E A SINISTRA */}
      <g transform="translate(120,120) scale(0.8,0.8)">
        <circle cx="150" cy="135" r="6" fill={skinColor} stroke="#000" strokeWidth="4" />
      </g>
    </svg>
  );
}
