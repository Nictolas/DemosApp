import React from "react";

interface NormalNoseStyleProps {
  skinColor: string;
}

export function NormalNoseStyle({ skinColor }: NormalNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO NORMALE IDENTICO ALL'AVATAR */}
      <g transform="translate(120,120) scale(1.8,1.8)">
        <path
          d="M 145 135 Q 150 140 155 135"
          stroke="#000"
          strokeWidth="3"
          fill="none"
        />
      </g>
    </svg>
  );
}
