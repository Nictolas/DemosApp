import React from "react";

interface BuzzHairStyleProps {
  hairColor: string;
}

export function BuzzHairStyle({ hairColor }: BuzzHairStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* CAPELLI RASATI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
      <g transform="translate(-75,0) scale(1.5,1.5)" fill={hairColor} stroke="black" strokeWidth="3">
        {/* Ciocca sinistra abbassata con punta più verso l'interno */}
        <path
          d="
            M90 80 
            Q80 110 90 140 
            Q95 130 100 110 
            Q95 90 90 80 
            Z
          "
        />

        {/* Ciocca destra abbassata con punta più verso l'interno */}
        <path
          d="
            M210 80 
            Q220 110 210 140 
            Q205 130 200 110 
            Q205 90 210 80 
            Z
          "
        />
      </g>
    </svg>
  );
}
