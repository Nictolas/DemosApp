import React from "react";

interface SquareGlassesStyleProps {
  // Nessuna prop necessaria per gli occhiali
}

export function SquareGlassesStyle({}: SquareGlassesStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI QUADRATI IDENTICI ALL'AVATAR */}
      <g transform="translate(5,60) scale(3.0,3.0)">
        {/* Lente sinistra */}
        <rect x="13" y="13" width="24" height="24" fill="none" stroke="#333" strokeWidth="2"/>
        {/* Lente destra */}
        <rect x="63" y="13" width="24" height="24" fill="none" stroke="#333" strokeWidth="2"/>
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
