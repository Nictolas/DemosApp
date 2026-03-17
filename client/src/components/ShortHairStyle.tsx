import React from "react";

interface ShortHairStyleProps {
  hairColor: string;
}

export function ShortHairStyle({ hairColor }: ShortHairStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* CAPELLI CORTI IDENTICI ALL'AVATAR - COORDINATE IDENTICHE */}
      <g transform="translate(20,300) scale(0.10,-0.10)" fill={hairColor} stroke="black" strokeWidth="50">
        <path d="M1134 2455 
          c-198 -36 -343 -109 -416 -211 
          -31 -43 -32 -44 -89 -44 
          -118 0 -265 -70 -347 -167 
          -48 -56 -94 -147 -118 -233 
          -26 -91 -26 -427 -1 -585 
          19 -118 50 -195 79 -195 
          10 0 36 -16 58 -36 
          35 -32 44 -35 64 -26 
          19 9 24 21 30 72 
          10 87 42 182 68 207 
          13 11 43 31 68 43 
          80 40 162 133 215 245 
          27 55 49 101 50 102 
          0 1 39 -17 85 -41 
          116 -60 246 -110 365 -141 
          126 -33 188 -40 345 -40 
          147 1 260 28 281 68 
          17 31 28 37 73 37 
          95 0 177 -53 220 -143 
          27 -55 50 -175 62 -315 
          6 -76 8 -84 31 -95 
          22 -10 28 -7 58 26 
          19 20 38 37 42 37 
          5 0 21 24 36 53 
          39 79 60 257 54 462 
          -6 196 -27 288 -98 434 
          -44 91 -63 116 -142 196 
          -129 129 -267 205 -465 256 
          -180 46 -457 62 -608 34" />
      </g>
    </svg>
  );
}
