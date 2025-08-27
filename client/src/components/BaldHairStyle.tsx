import React from "react";

interface BaldHairStyleProps {
  hairColor: string;
}

export function BaldHairStyle({ hairColor }: BaldHairStyleProps) {
  return (
          <div className="text-gray-400 text-xs text-center">
        <svg className="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </div>
  );
}
