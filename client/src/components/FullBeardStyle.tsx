import React from "react";

interface FullBeardStyleProps {
  beardColor: string;
}

export function FullBeardStyle({ beardColor }: FullBeardStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* BARBA PIENA IDENTICA ALL'AVATAR - COORDINATE IDENTICHE */}
      <g transform="translate(150, 220) scale(0.08,-0.08)" fill={beardColor}>
        <path
          d="M120 200 Q150 240 180 200 Q180 240 150 280 Q120 240 120 200 Z"
        />
        <path
          d="M135 220 Q150 260 165 220 Q165 260 150 300 Q135 260 135 220 Z"
        />
      </g>
    </svg>
  );
}
