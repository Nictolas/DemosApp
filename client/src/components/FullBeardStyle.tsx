import React from "react";

interface FullBeardStyleProps {
  beardColor: string;
}

export function FullBeardStyle({ beardColor }: FullBeardStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* BARBA PIENA IDENTICA ALL'AVATAR - COORDINATE IDENTICHE */}
      <g transform="translate(-150,-130) scale(2.0,2.0)" fill={beardColor}>
        <path
          d="M100 170 Q150 200 200 170 Q200 200 150 210 Q100 200 100 170 Z"
          stroke="black"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}
