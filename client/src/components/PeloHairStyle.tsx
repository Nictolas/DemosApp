import React from "react";

interface PeloHairStyleProps {
  hairColor: string;
}

export function PeloHairStyle({ hairColor }: PeloHairStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* CAPELLI PELO - DESIGN SEMPLICE E POSIZIONATO A SINISTRA E IN BASSO */}
      <g transform="translate(-120,40) scale(1.8,1.8)" fill={hairColor} stroke="black" strokeWidth="1">
        <path
          d="M100 80 Q150 50 200 80 Q200 50 150 40 Q100 50 100 80 Z"
        />
      </g>
    </svg>
  );
}
