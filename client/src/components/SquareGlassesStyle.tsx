import React from "react";

interface SquareGlassesStyleProps {
  glassesColor: string;
}

export function SquareGlassesStyle({ glassesColor }: SquareGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI QUADRATI - POSIZIONATI MOLTO PIÙ IN ALTO E A SINISTRA */}
      <g transform="translate(15,25) scale(2.5,2.5)">
        {/* Lente sinistra */}
        <rect x="13" y="13" width="24" height="24" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Lente destra */}
        <rect x="63" y="13" width="24" height="24" fill="none" stroke={defaultColor} strokeWidth="3"/>
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
