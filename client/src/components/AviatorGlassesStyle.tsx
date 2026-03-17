import React from "react";

interface AviatorGlassesStyleProps {
  glassesColor: string;
}

export function AviatorGlassesStyle({ glassesColor }: AviatorGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-full h-full" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI AVIATOR - INGRANDITI MOLTO */}
      <g>
        {/* Lente sinistra - MOLTO più grande */}
        <ellipse cx="100" cy="150" rx="35" ry="25" fill="none" stroke={defaultColor} strokeWidth="8"/>
        {/* Lente destra - MOLTO più grande */}
        <ellipse cx="200" cy="150" rx="35" ry="25" fill="none" stroke={defaultColor} strokeWidth="8"/>
        {/* Ponte naso - più spesso */}
        <path d="M 135 150 L 165 150" stroke={defaultColor} strokeWidth="8"/>
        {/* Tempie sinistra - più lunghe */}
        <path d="M 65 150 L 45 150" stroke={defaultColor} strokeWidth="8"/>
        {/* Tempie destra - più lunghe */}
        <path d="M 235 150 L 255 150" stroke={defaultColor} strokeWidth="8"/>
      </g>
    </svg>
  );
}
