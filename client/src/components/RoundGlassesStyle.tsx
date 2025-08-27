import React from "react";

interface RoundGlassesStyleProps {
  glassesColor: string;
}

export function RoundGlassesStyle({ glassesColor }: RoundGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI ROTONDI IDENTICI ALL'AVATAR */}
      <g transform="translate(5,60) scale(3.0,3.0)">
        {/* Lente sinistra - più grande e visibile */}
        <circle cx="25" cy="25" r="15" fill="none" stroke={defaultColor} strokeWidth="2"/>
        {/* Lente destra - più grande e visibile */}
        <circle cx="75" cy="25" r="15" fill="none" stroke={defaultColor} strokeWidth="2"/>
        {/* Ponte centrale */}
        <path d="M37 25 L63 25" stroke={defaultColor} strokeWidth="2"/>
        {/* Stanghette sinistra - più lunga e visibile */}
        <path d="M0 25 L15 25" stroke={defaultColor} strokeWidth="2"/>
        {/* Stanghetta destra - più lunga e visibile */}
        <path d="M85 25 L100 25" stroke={defaultColor} strokeWidth="2"/>
      </g>
    </svg>
  );
}
