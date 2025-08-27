import React from "react";

interface StubbleBeardStyleProps {
  beardColor: string;
}

export function StubbleBeardStyle({ beardColor }: StubbleBeardStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* BARBA INCOLTA IDENTICA ALL'AVATAR - COORDINATE IDENTICHE */}
      <g transform="translate(150, 220) scale(0.08,-0.08)" fill={beardColor} opacity="0.3">
        <ellipse
          cx="150"
          cy="200"
          rx="160"
          ry="80"
        />
      </g>
    </svg>
  );
}
