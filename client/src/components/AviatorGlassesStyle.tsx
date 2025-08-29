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
        <path d="M110 110 L140 110 Q140 140 125 150 Q110 140 L110 110 Z" fill="none" stroke={defaultColor} strokeWidth="4"/>
        {/* Lente destra - path esatto dell'Anteprima Avatar */}
        <path d="M160 110 L190 110 Q190 140 175 150 Q160 140 L160 110 Z" fill="none" stroke={defaultColor} strokeWidth="4"/>
        {/* Ponte centrale - path esatto dell'Anteprima Avatar */}
        <path d="M140 125 L160 125" stroke={defaultColor} strokeWidth="4"/>
        {/* Stanghette - path esatto dell'Anteprima Avatar */}
        <path d="M95 125 L110 125" stroke={defaultColor} strokeWidth="4"/>
        <path d="M190 125 L205 125" stroke={defaultColor} strokeWidth="4"/>
      </g>
    </svg>
  );
}
