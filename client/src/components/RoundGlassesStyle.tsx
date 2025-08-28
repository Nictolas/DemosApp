import React from "react";

interface RoundGlassesStyleProps {
  glassesColor: string;
}

export function RoundGlassesStyle({ glassesColor }: RoundGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI ROTONDI - POSIZIONATI MOLTO PIÙ IN ALTO E A SINISTRA */}
      <g transform="translate(15,25) scale(2.5,2.5)">
        {/* Lente sinistra */}
        <circle cx="25" cy="25" r="12" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Lente destra */}
        <circle cx="75" cy="25" r="12" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Ponte centrale */}
        <path d="M37 25 L63 25" stroke={defaultColor} strokeWidth="3"/>
        {/* Stanghette sinistra */}
        <path d="M5 25 L12 25" stroke={defaultColor} strokeWidth="3"/>
        {/* Stanghetta destra */}
        <path d="M88 25 L95 25" stroke={defaultColor} strokeWidth="3"/>
      </g>
    </svg>
  );
}
