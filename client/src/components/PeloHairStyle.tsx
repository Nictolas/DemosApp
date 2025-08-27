import React from "react";

interface PeloHairStyleProps {
  hairColor: string;
}

export function PeloHairStyle({ hairColor }: PeloHairStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* CAPELLI PELO - COME BARBA PIENA MA SOTTOSOPRA */}
      <g transform="translate(0,0) scale(1.5,1.5)" fill={hairColor} stroke="black" strokeWidth="1">
        <path
          d="M100 80 Q150 50 200 80 Q200 50 150 40 Q100 50 100 80 Z"
          stroke="black"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}
