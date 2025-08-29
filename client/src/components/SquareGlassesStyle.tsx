import React from "react";

interface SquareGlassesStyleProps {
  glassesColor: string;
}

export function SquareGlassesStyle({ glassesColor }: SquareGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI QUADRATI - PATH ESATTI DELL'ANTEPRIMA AVATAR - SCALA AUMENTATA */}
      <g>
        {/* Lente sinistra - path esatto dell'Anteprima Avatar */}
        <rect x="110" y="110" width="30" height="30" fill="none" stroke={defaultColor} strokeWidth="4"/>
        {/* Lente destra - path esatto dell'Anteprima Avatar */}
        <rect x="160" y="110" width="30" height="30" fill="none" stroke={defaultColor} strokeWidth="4"/>
        {/* Ponte centrale - path esatto dell'Anteprima Avatar */}
        <path d="M140 125 L160 125" stroke={defaultColor} strokeWidth="4"/>
        {/* Stanghette - path esatto dell'Anteprima Avatar */}
        <path d="M95 125 L110 125" stroke={defaultColor} strokeWidth="4"/>
        <path d="M190 125 L205 125" stroke={defaultColor} strokeWidth="4"/>
      </g>
    </svg>
  );
}
