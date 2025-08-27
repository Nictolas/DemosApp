import React from "react";

interface AviatorGlassesStyleProps {
  glassesColor: string;
}

export function AviatorGlassesStyle({ glassesColor }: AviatorGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI AVIATOR IDENTICI ALL'AVATAR */}
      <g transform="translate(5,60) scale(3.0,3.0)">
        {/* Lente sinistra - forma aviator completamente chiusa e più grande */}
        <path d="M5 10 L40 10 Q40 40 22.5 50 Q5 40 L5 10 Z" fill="none" stroke={defaultColor} strokeWidth="2"/>
        {/* Lente destra - forma aviator completamente chiusa e più grande */}
        <path d="M60 10 L95 10 Q95 40 77.5 50 Q60 40 L60 10 Z" fill="none" stroke={defaultColor} strokeWidth="2"/>
        {/* Ponte centrale */}
        <path d="M37 25 L63 25" stroke={defaultColor} strokeWidth="2"/>
        {/* Stanghette sinistra */}
        <path d="M0 25 L10 25" stroke={defaultColor} strokeWidth="2"/>
        {/* Stanghetta destra */}
        <path d="M90 25 L100 25" stroke={defaultColor} strokeWidth="2"/>
      </g>
    </svg>
  );
}
