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
        <rect x="113" y="113" width="24" height="24" fill="none" stroke={defaultColor} strokeWidth="2"/>
        {/* Lente destra - path esatto dell'Anteprima Avatar */}
        <rect x="163" y="113" width="24" height="24" fill="none" stroke={defaultColor} strokeWidth="2"/>
        {/* Ponte centrale - path esatto dell'Anteprima Avatar */}
        <path d="M137 125 L163 125" stroke={defaultColor} strokeWidth="2"/>
        {/* Stanghette - path esatto dell'Anteprima Avatar */}
        <path d="M100 125 L113 125" stroke={defaultColor} strokeWidth="2"/>
        <path d="M187 125 L200 125" stroke={defaultColor} strokeWidth="2"/>
      </g>
    </svg>
  );
}
