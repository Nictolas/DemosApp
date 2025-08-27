import React from "react";

interface AviatorGlassesStyleProps {
  // Nessuna prop necessaria per gli occhiali
}

export function AviatorGlassesStyle({}: AviatorGlassesStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI AVIATOR IDENTICI ALL'AVATAR */}
      <g transform="translate(10,60) scale(3.0,3.0)">
                 {/* Lente sinistra - forma aviator */}
         <path d="M10 13 Q25 3 40 13 Q40 37 25 47 Q10 37 10 13 Z" fill="none" stroke="#333" strokeWidth="2"/>
         {/* Lente destra - forma aviator */}
         <path d="M60 13 Q75 3 90 13 Q90 37 75 47 Q60 37 60 13 Z" fill="none" stroke="#333" strokeWidth="2"/>
        {/* Ponte centrale */}
        <path d="M37 25 L63 25" stroke="#333" strokeWidth="2"/>
                 {/* Stanghette sinistra */}
         <path d="M5 25 L12 25" stroke="#333" strokeWidth="2"/>
         {/* Stanghetta destra */}
         <path d="M88 25 L95 25" stroke="#333" strokeWidth="2"/>
      </g>
    </svg>
  );
}
