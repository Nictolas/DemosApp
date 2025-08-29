import React from "react";

interface CurvedNoseStyleProps {
  skinColor: string;
}

export function CurvedNoseStyle({ skinColor }: CurvedNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO CURVO - SPOSTATO PIÙ IN ALTO E A SINISTRA */}
      <g transform="translate(130,130) scale(0.8,0.8)">
        <path d="M 145 135 Q 150 145 155 135" stroke="#000" strokeWidth="3" fill="none" />
      </g>
    </svg>
  );
}
