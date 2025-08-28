import React from "react";

interface AviatorGlassesStyleProps {
  glassesColor: string;
}

export function AviatorGlassesStyle({ glassesColor }: AviatorGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI AVIATOR - POSIZIONATI MOLTO PIÙ IN ALTO E A SINISTRA */}
      <g transform="translate(15,25) scale(2.5,2.5)">
        {/* Lente sinistra - forma aviator completamente chiusa */}
        <path d="M10 13 L40 13 Q40 37 25 47 Q10 37 Z" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Lente destra - forma aviator completamente chiusa */}
        <path d="M60 13 L90 13 Q90 37 75 47 Q60 37 Z" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Ponte centrale */}
        <path d="M37 25 L63 25" stroke={defaultColor} strokeWidth="3"/>
        {/* Stanghette sinistra */}
        <path d="M5 25 L12 25" stroke={defaultColor} strokeWidth="3"/>
        {/* Stanghetta destra */}
        <path d="M88 25 L95 25" stroke={defaultColor} strokeWidth="3"/>
      </g>
    </svg>
  );
}
