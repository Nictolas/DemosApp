import React from "react";

interface ArrowNoseStyleProps {
  skinColor: string;
}

export function ArrowNoseStyle({ skinColor }: ArrowNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO A FRECCIA - SPOSTATO PIÙ IN ALTO E A SINISTRA */}
      <g transform="translate(130,130) scale(0.8,0.8)">
        <path d="M 155 135 L 145 140 L 155 145" stroke="#000" strokeWidth="3" fill="none" />
      </g>
    </svg>
  );
}
