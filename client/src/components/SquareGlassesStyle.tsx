import React from "react";

interface SquareGlassesStyleProps {
  glassesColor: string;
}

export function SquareGlassesStyle({ glassesColor }: SquareGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-full h-full" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI QUADRATI - INGRANDITI MOLTO */}
      <g>
        {/* Lente sinistra - MOLTO più grande */}
        <rect x="65" y="115" width="70" height="70" fill="none" stroke={defaultColor} strokeWidth="8"/>
        {/* Lente destra - MOLTO più grande */}
        <rect x="165" y="115" width="70" height="70" fill="none" stroke={defaultColor} strokeWidth="8"/>
        {/* Ponte naso - più spesso */}
        <path d="M 135 150 L 165 150" stroke={defaultColor} strokeWidth="8"/>
        {/* Tempie sinistra - più lunghe e collegate */}
        <path d="M 65 150 L 35 150" stroke={defaultColor} strokeWidth="8"/>
        {/* Tempie destra - più lunghe */}
        <path d="M 235 150 L 255 150" stroke={defaultColor} strokeWidth="8"/>
      </g>
    </svg>
  );
}
