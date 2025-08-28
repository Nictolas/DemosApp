import React from "react";

interface AviatorGlassesStyleProps {
  glassesColor: string;
}

export function AviatorGlassesStyle({ glassesColor }: AviatorGlassesStyleProps) {
  const defaultColor = glassesColor || "#333333";
  
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* OCCHIALI AVIATOR - POSIZIONATI correttamente sopra gli occhi */}
      <g>
        {/* Lente sinistra - forma aviator corretta */}
        <path d="M110 110 L140 110 Q140 140 125 150 Q110 140 Z" fill="none" stroke={defaultColor} strokeWidth="3"/>
        {/* Lente destra - forma aviator corretta */}
        <path d="M160 110 L190 110 Q190 140 175 150 Q160 140 Z" fill="none" stroke={defaultColor} strokeWidth="3"/>
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
