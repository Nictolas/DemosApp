import React from "react";

interface AvatarClothingProps {
  suitColor: string;
  tieColor: string;
  skinColor?: string;
}

export function AvatarClothing({ suitColor, tieColor, skinColor = "#FDBCB4" }: AvatarClothingProps) {
  return (
    <>
      {/* Collo trapezoidale (dietro tutto) */}
      <path
        d="M130 195 L170 195 L180 225 L120 225 Z"
        fill={skinColor}
        stroke="#000"
        strokeWidth="3"
      />
      
      {/* Spalle con braccia ancora più in alto */}
      <ellipse
        cx="150"
        cy="249"
        rx="122"
        ry="40"
        fill={suitColor}
        stroke="#000"
        strokeWidth="3"
      />
      
      {/* Giacca con forma migliorata */}
      <path
        d="M60 220 Q120 210 150 210 Q180 210 240 220 L240 300 L60 300 Z"
        fill={suitColor}
        stroke="#000"
        strokeWidth="3"
      />
      
      {/* Lapels della giacca */}
      <path
        d="M105 225 L125 240 L135 210 L115 210 Z"
        fill={suitColor}
        stroke="#000"
        strokeWidth="3"
      />
      <path
        d="M195 225 L175 240 L165 210 L185 210 Z"
        fill={suitColor}
        stroke="#000"
        strokeWidth="3"
      />
      
      {/* Camicia */}
      <path
        d="M130 210 Q140 205 150 205 Q160 205 170 210 L170 300 L130 300 Z"
        fill="#FFFFFF"
        stroke="#000"
        strokeWidth="3"
      />
      
      {/* Colletto della camicia */}
      <path
        d="M135 210 L145 200 L150 215 L155 200 L165 210"
        fill="#FFFFFF"
        stroke="#000"
        strokeWidth="3"
      />
      
      {/* Nodo cravatta */}
      <ellipse
        cx="150"
        cy="220"
        rx="10"
        ry="8"
        fill={tieColor}
        stroke="#000"
        strokeWidth="3"
      />
      
      {/* Cravatta */}
      <path
        d="M140 227 L160 227 L158 275 L150 285 L142 275 Z"
        fill={tieColor}
        stroke="#000"
        strokeWidth="3"
      />
    </>
  );
}
