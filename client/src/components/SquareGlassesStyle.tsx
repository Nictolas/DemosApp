import React from "react";

interface SquareGlassesStyleProps {
  glassesColor: string;
}

export function SquareGlassesStyle({ glassesColor }: SquareGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI QUADRATI - SCALA AUMENTATA PER MAGGIORE VISIBILITÀ */}
      <g>
        {/* Lente sinistra - rettangolo più grande */}
        <rect x="85" y="85" width="35" height="35" fill="none" stroke={defaultColor} strokeWidth="5"/>
        {/* Lente destra - rettangolo più grande */}
        <rect x="180" y="85" width="35" height="35" fill="none" stroke={defaultColor} strokeWidth="5"/>
        {/* Ponte centrale - più spesso */}
        <path d="M120 100 L180 100" stroke={defaultColor} strokeWidth="5"/>
        {/* Stanghette - più spesse e visibili */}
        <path d="M70 100 L85 100" stroke={defaultColor} strokeWidth="5"/>
        <path d="M215 100 L230 100" stroke={defaultColor} strokeWidth="5"/>
      </g>
    </svg>
  );
}
