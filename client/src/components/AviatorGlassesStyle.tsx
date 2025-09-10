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
        <ellipse cx="125" cy="125" rx="12" ry="8" fill="none" stroke={defaultColor} strokeWidth="2"/>
        {/* Lente destra - path esatto dell'Anteprima Avatar */}
        <ellipse cx="175" cy="125" rx="12" ry="8" fill="none" stroke={defaultColor} strokeWidth="2"/>
        {/* Ponte centrale - path esatto dell'Anteprima Avatar */}
        <path d="M137 125 L163 125" stroke={defaultColor} strokeWidth="2"/>
        {/* Stanghette - path esatto dell'Anteprima Avatar */}
        <path d="M100 125 L113 125" stroke={defaultColor} strokeWidth="2"/>
        <path d="M187 125 L200 125" stroke={defaultColor} strokeWidth="2"/>
      </g>
    </svg>
  );
}
