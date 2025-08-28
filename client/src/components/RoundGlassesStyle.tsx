import React from "react";

interface RoundGlassesStyleProps {
  glassesColor: string;
}

export function RoundGlassesStyle({ glassesColor }: RoundGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI ROTONDI - POSIZIONATI correttamente sopra gli occhi */}
      <g>
        {/* Lente sinistra */}
        <circle cx="125" cy="125" r="15" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Lente destra */}
        <circle cx="175" cy="125" r="15" fill="none" stroke={defaultColor} strokeWidth="3"/>
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
