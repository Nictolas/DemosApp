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
        <path d="M113 113 L137 113 Q137 137 125 140 Q113 137 L113 113 Z" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Lente destra - path esatto dell'Anteprima Avatar */}
        <path d="M163 113 L187 113 Q187 137 175 140 Q163 137 L163 113 Z" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Ponte centrale - path esatto dell'Anteprima Avatar */}
        <path d="M137 125 L163 125" stroke={defaultColor} strokeWidth="3"/>
        {/* Stanghette - path esatto dell'Anteprima Avatar */}
        <path d="M100 125 L113 125" stroke={defaultColor} strokeWidth="3"/>
        <path d="M187 125 L200 125" stroke={defaultColor} strokeWidth="3"/>
      </g>
    </svg>
  );
}
