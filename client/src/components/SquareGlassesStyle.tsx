import React from "react";

interface SquareGlassesStyleProps {
  glassesColor: string;
}

export function SquareGlassesStyle({ glassesColor }: SquareGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI QUADRATI IDENTICI ALL'AVATAR */}
      <g transform="translate(5,60) scale(3.0,3.0)">
        {/* Lente sinistra - più grande e visibile */}
        <rect x="10" y="10" width="30" height="30" fill="none" stroke={defaultColor} strokeWidth="2"/>
        {/* Lente destra - più grande e visibile */}
        <rect x="60" y="10" width="30" height="30" fill="none" stroke={defaultColor} strokeWidth="2"/>
        {/* Ponte centrale */}
        <path d="M37 25 L63 25" stroke={defaultColor} strokeWidth="2"/>
        {/* Stanghette sinistra - più lunga e visibile */}
        <path d="M0 25 L15 25" stroke={defaultColor} strokeWidth="2"/>
        {/* Stanghette destra - più lunga e visibile */}
        <path d="M85 25 L100 25" stroke={defaultColor} strokeWidth="2"/>
      </g>
    </svg>
  );
}
