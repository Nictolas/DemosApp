import React from "react";

interface AviatorGlassesStyleProps {
  glassesColor: string;
}

export function AviatorGlassesStyle({ glassesColor }: AviatorGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI AVIATOR - INGRANDITI E POSIZIONATI CORRETTAMENTE */}
      <g>
        {/* Lente sinistra - forma aviator più grande */}
        <path d="M80 80 L120 80 Q120 120 100 130 Q80 120 Z" fill="none" stroke={defaultColor} strokeWidth="4"/>
        {/* Lente destra - forma aviator più grande */}
        <path d="M180 80 L220 80 Q220 120 200 130 Q180 120 Z" fill="none" stroke={defaultColor} strokeWidth="4"/>
        {/* Ponte centrale - più spesso */}
        <path d="M120 100 L180 100" stroke={defaultColor} strokeWidth="4"/>
        {/* Stanghette - più spesse e visibili */}
        <path d="M70 100 L80 100" stroke={defaultColor} strokeWidth="4"/>
        <path d="M220 100 L230 100" stroke={defaultColor} strokeWidth="4"/>
      </g>
    </svg>
  );
}
