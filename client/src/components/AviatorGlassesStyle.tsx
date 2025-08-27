import React from "react";

interface AviatorGlassesStyleProps {
  // Nessuna prop necessaria per gli occhiali
}

export function AviatorGlassesStyle({}: AviatorGlassesStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI AVIATOR IDENTICI ALL'AVATAR */}
      <g transform="translate(80,100) scale(1.5,1.5)">
        {/* Lente sinistra - forma aviator */}
        <path d="M13 13 Q25 3 37 13 Q37 37 25 47 Q13 37 13 13 Z" fill="none" stroke="#333" strokeWidth="2"/>
        {/* Lente destra - forma aviator */}
        <path d="M63 13 Q75 3 87 13 Q87 37 75 47 Q63 37 63 13 Z" fill="none" stroke="#333" strokeWidth="2"/>
        {/* Ponte centrale */}
        <path d="M37 25 L63 25" stroke="#333" strokeWidth="2"/>
        {/* Stanghette sinistra */}
        <path d="M13 25 L20 25" stroke="#333" strokeWidth="2"/>
        {/* Stanghetta destra */}
        <path d="M80 25 L87 25" stroke="#333" strokeWidth="2"/>
      </g>
    </svg>
  );
}
