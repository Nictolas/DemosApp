import React from "react";

interface RoundGlassesStyleProps {
  glassesColor: string;
}

export function RoundGlassesStyle({ glassesColor }: RoundGlassesStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI ROTONDI IDENTICI ALL'AVATAR */}
      <g transform="translate(5,60) scale(3.0,3.0)">
        {/* Lente sinistra */}
        <circle cx="25" cy="25" r="12" fill="none" stroke={glassesColor} strokeWidth="2"/>
        {/* Lente destra */}
        <circle cx="75" cy="25" r="12" fill="none" stroke={glassesColor} strokeWidth="2"/>
        {/* Ponte centrale */}
        <path d="M37 25 L63 25" stroke={glassesColor} strokeWidth="2"/>
                 {/* Stanghette sinistra */}
         <path d="M5 25 L12 25" stroke={glassesColor} strokeWidth="2"/>
         {/* Stanghetta destra */}
         <path d="M88 25 L95 25" stroke={glassesColor} strokeWidth="2"/>
      </g>
    </svg>
  );
}
