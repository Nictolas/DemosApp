import React from "react";

interface SquareGlassesStyleProps {
  glassesColor: string;
}

export function SquareGlassesStyle({ glassesColor }: SquareGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI QUADRATI - POSIZIONATI correttamente sopra gli occhi */}
      <g>
        {/* Lente sinistra */}
        <rect x="110" y="110" width="30" height="30" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Lente destra */}
        <rect x="160" y="110" width="30" height="30" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Ponte centrale */}
        <path d="M140 125 L160 125" stroke={defaultColor} strokeWidth="3"/>
        {/* Stanghetta sinistra */}
        <path d="M95 125 L110 125" stroke={defaultColor} strokeWidth="3"/>
        {/* Stanghetta destra */}
        <path d="M190 125 L205 125" stroke={defaultColor} strokeWidth="3"/>
      </g>
    </svg>
  );
}
