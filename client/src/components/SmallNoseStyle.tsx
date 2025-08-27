import React from "react";

interface SmallNoseStyleProps {
  skinColor: string;
}

export function SmallNoseStyle({ skinColor }: SmallNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO PICCOLO IDENTICO ALL'AVATAR */}
      <g transform="translate(100,100) scale(1.8,1.8)">
        <path
          d="M 148 135 Q 150 138 152 135"
          stroke="#000"
          strokeWidth="2"
          fill="none"
        />
      </g>
    </svg>
  );
}
