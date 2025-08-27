import React from "react";

interface ButtonNoseStyleProps {
  skinColor: string;
}

export function ButtonNoseStyle({ skinColor }: ButtonNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO A BOTTONE IDENTICO ALL'AVATAR */}
      <g transform="translate(100,100) scale(1.8,1.8)">
        <circle
          cx="150"
          cy="135"
          r="3"
          fill={skinColor}
          stroke="#000"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
