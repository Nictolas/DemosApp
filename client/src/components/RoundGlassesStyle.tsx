import React from "react";

interface RoundGlassesStyleProps {
  glassesColor: string;
}

export function RoundGlassesStyle({ glassesColor }: RoundGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI ROTONDI - INGRANDITI E POSIZIONATI CORRETTAMENTE */}
      <g>
        {/* Lente sinistra - più grande */}
        <circle cx="100" cy="100" r="20" fill="none" stroke={defaultColor} strokeWidth="4"/>
        {/* Lente destra - più grande */}
        <circle cx="200" cy="100" r="20" fill="none" stroke={defaultColor} strokeWidth="4"/>
        {/* Ponte centrale - più spesso */}
        <path d="M120 100 L180 100" stroke={defaultColor} strokeWidth="4"/>
        {/* Stanghette - più spesse e visibili */}
        <path d="M70 100 L80 100" stroke={defaultColor} strokeWidth="4"/>
        <path d="M220 100 L230 100" stroke={defaultColor} strokeWidth="4"/>
      </g>
    </svg>
  );
}
