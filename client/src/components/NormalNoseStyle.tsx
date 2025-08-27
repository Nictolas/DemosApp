import React from "react";

interface NormalNoseStyleProps {
  skinColor: string;
}

export function NormalNoseStyle({ skinColor }: NormalNoseStyleProps) {
  return (
    <svg className="w-12 h-12" viewBox="0 0 300 300" fill="currentColor">
      {/* NASO NORMALE IDENTICO ALL'AVATAR */}
              <path d="M 145 135 Q 150 140 155 135" stroke="#000" strokeWidth="3" fill="none" transform="translate(0,0)" />
    </svg>
  );
}
