import React from "react";

interface AviatorGlassesStyleProps {
  glassesColor: string;
}

export function AviatorGlassesStyle({ glassesColor }: AviatorGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI AVIATOR IDENTICI ALL'AVATAR */}
      <g transform="translate(5,60) scale(3.0,3.0)">
                           {/* Lente sinistra - forma aviator con parte superiore piatta e inferiore a "U" */}
         <path d="M10 13 L40 13 Q40 37 25 47 Q10 37 L10 13 Z" fill="none" stroke={defaultColor} strokeWidth="2"/>
         {/* Lente destra - forma aviator con parte superiore piatta e inferiore a "U" */}
         <path d="M60 13 L90 13 Q90 37 75 47 Q60 37 L60 13 Z" fill="none" stroke={defaultColor} strokeWidth="2"/>
         {/* Ponte centrale */}
         <path d="M37 25 L63 25" stroke={defaultColor} strokeWidth="2"/>
                  {/* Stanghette sinistra */}
          <path d="M5 25 L12 25" stroke={defaultColor} strokeWidth="2"/>
          {/* Stanghetta destra */}
          <path d="M88 25 L95 25" stroke={defaultColor} strokeWidth="2"/>
      </g>
    </svg>
  );
}
