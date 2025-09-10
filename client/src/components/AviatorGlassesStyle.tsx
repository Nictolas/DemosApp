import React from "react";

interface AviatorGlassesStyleProps {
  glassesColor: string;
}

export function AviatorGlassesStyle({ glassesColor }: AviatorGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI AVIATOR - PATH ESATTI DELL'ANTEPRIMA AVATAR - SCALA AUMENTATA */}
      <g>
        {/* Lente sinistra - path esatto dell'Anteprima Avatar */}
        <ellipse cx="125" cy="125" rx="16" ry="12" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Lente destra - path esatto dell'Anteprima Avatar */}
        <ellipse cx="175" cy="125" rx="16" ry="12" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Ponte centrale - path esatto dell'Anteprima Avatar */}
        <path d="M141 125 L159 125" stroke={defaultColor} strokeWidth="3"/>
        {/* Stanghette - path esatto dell'Anteprima Avatar */}
        <path d="M95 125 L109 125" stroke={defaultColor} strokeWidth="3"/>
        <path d="M191 125 L205 125" stroke={defaultColor} strokeWidth="3"/>
      </g>
    </svg>
  );
}
