import React from "react";

interface WavyHairStyleProps {
  hairColor: string;
}

export function WavyHairStyle({ hairColor }: WavyHairStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* CAPELLI ONDULATI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
      <g transform="translate(-95,0) scale(1.7,1.7)" fill={hairColor} stroke="black" strokeWidth="3">
        <path d="M90 60 
           Q110 40 150 45 
           Q190 40 210 60 
           Q220 80 215 100 
           Q210 115 200 120 
           Q195 100 195 85 
           Q195 70 180 65 
           Q165 60 150 62 
           Q135 60 120 65 
           Q105 70 105 85 
           Q105 100 100 120 
           Q90 115 85 100 
           Q80 80 90 60 
           Z" />
      </g>
    </svg>
  );
}
