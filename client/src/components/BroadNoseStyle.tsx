import React from "react";

interface BroadNoseStyleProps {
  skinColor: string;
}

export function BroadNoseStyle({ skinColor }: BroadNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO LARGO - SPOSTATO PIÙ IN ALTO E A SINISTRA */}
      <g transform="translate(130,130) scale(0.8,0.8)">
        <path d="M 140 135 Q 150 140 160 135" stroke="#000" strokeWidth="4" fill="none" />
      </g>
    </svg>
  );
}
