import React from "react";

interface RoundGlassesStyleProps {
  glassesColor: string;
}

export function RoundGlassesStyle({ glassesColor }: RoundGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI ROTONDI - SCALA AUMENTATA PER MAGGIORE VISIBILITÀ */}
      <g>
        {/* Lente sinistra - ancora più grande */}
        <circle cx="100" cy="100" r="25" fill="none" stroke={defaultColor} strokeWidth="5"/>
        {/* Lente destra - ancora più grande */}
        <circle cx="200" cy="100" r="25" fill="none" stroke={defaultColor} strokeWidth="5"/>
        {/* Ponte centrale - più spesso */}
        <path d="M125 100 L175 100" stroke={defaultColor} strokeWidth="5"/>
        {/* Stanghette - più spesse e visibili */}
        <path d="M65 100 L75 100" stroke={defaultColor} strokeWidth="5"/>
        <path d="M225 100 L235 100" stroke={defaultColor} strokeWidth="5"/>
      </g>
    </svg>
  );
}
