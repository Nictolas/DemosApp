import React from "react";

interface GoateeBeardStyleProps {
  beardColor: string;
}

export function GoateeBeardStyle({ beardColor }: GoateeBeardStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* PIZZETTO IDENTICO ALL'AVATAR - COORDINATE IDENTICHE */}
      <g transform="translate(150, 220) scale(0.08,-0.08)" fill={beardColor}>
        <ellipse
          cx="150"
          cy="150"
          rx="40"
          ry="60"
        />
      </g>
    </svg>
  );
}
