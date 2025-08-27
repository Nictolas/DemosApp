import React from "react";

interface GoateeBeardStyleProps {
  beardColor: string;
}

export function GoateeBeardStyle({ beardColor }: GoateeBeardStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* PIZZETTO IDENTICO ALL'AVATAR - COORDINATE IDENTICHE */}
      <g transform="translate(-150,-130) scale(2.0,2.0)" fill={beardColor}>
        <ellipse
          cx="150"
          cy="190"
          rx="8"
          ry="12"
          stroke="black"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}
