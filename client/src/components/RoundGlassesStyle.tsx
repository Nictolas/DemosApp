import React from "react";

interface RoundGlassesStyleProps {
  glassesColor: string;
}

export function RoundGlassesStyle({ glassesColor }: RoundGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-36 h-36" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI ROTONDI - PATH ESATTI DELL'ANTEPRIMA AVATAR - SCALA AUMENTATA */}
      <g>
        {/* Lente sinistra - path esatto dell'Anteprima Avatar */}
        <circle cx="125" cy="125" r="16" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Lente destra - path esatto dell'Anteprima Avatar */}
        <circle cx="175" cy="125" r="16" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Ponte centrale - path esatto dell'Anteprima Avatar */}
        <path d="M141 125 L159 125" stroke={defaultColor} strokeWidth="3"/>
        {/* Stanghette - path esatto dell'Anteprima Avatar */}
        <path d="M95 125 L109 125" stroke={defaultColor} strokeWidth="3"/>
        <path d="M191 125 L205 125" stroke={defaultColor} strokeWidth="3"/>
      </g>
    </svg>
  );
}
