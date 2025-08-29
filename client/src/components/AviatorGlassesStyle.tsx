import React from "react";

interface AviatorGlassesStyleProps {
  glassesColor: string;
}

export function AviatorGlassesStyle({ glassesColor }: AviatorGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI AVIATOR - SCALA ULTERIORMENTE AUMENTATA PER MAGGIORE VISIBILITÀ */}
      <g>
        {/* Lente sinistra - forma aviator ancora più grande */}
        <path d="M70 70 L110 70 Q110 110 90 120 Q70 110 Z" fill="none" stroke={defaultColor} strokeWidth="5"/>
        {/* Lente destra - forma aviator ancora più grande */}
        <path d="M190 70 L230 70 Q230 110 210 120 Q190 110 Z" fill="none" stroke={defaultColor} strokeWidth="5"/>
        {/* Ponte centrale - più spesso */}
        <path d="M110 90 L190 90" stroke={defaultColor} strokeWidth="5"/>
        {/* Stanghette - più spesse e visibili */}
        <path d="M60 90 L70 90" stroke={defaultColor} strokeWidth="5"/>
        <path d="M230 90 L240 90" stroke={defaultColor} strokeWidth="5"/>
      </g>
    </svg>
  );
}
