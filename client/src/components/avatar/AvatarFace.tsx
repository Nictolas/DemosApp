import React from "react";

interface AvatarFaceProps {
  skinColor: string;
  noseStyle: string;
}

export function AvatarFace({ skinColor, noseStyle }: AvatarFaceProps) {
  const renderNose = () => {
    switch (noseStyle) {
      case "small":
        return <path d="M 148 135 Q 150 138 152 135" stroke="#000" strokeWidth="2" fill="none" />;
      case "large":
        return <path d="M 145 140 Q 150 150 155 140" stroke="#000" strokeWidth="3" fill="none" />;
      case "pointed":
        return <path d="M 148 133 L 150 140 L 152 133" stroke="#000" strokeWidth="2" fill="none" />;
      case "button":
        return <circle cx="150" cy="143" r="6" fill={skinColor} stroke="#000" strokeWidth="2" />;
      case "arrow":
        return <path d="M 148 135 L 140 140 L 148 145" stroke="#000" strokeWidth="3" fill="none" />;
      case "broad":
        return <path d="M 140 143 Q 150 148 160 143" stroke="#000" strokeWidth="4" fill="none" />;
      case "curved":
        return <path d="M 145 135 Q 150 145 155 135" stroke="#000" strokeWidth="3" fill="none" />;
      default: // normal
        return <path d="M 145 135 Q 150 140 155 135" stroke="#000" strokeWidth="3" fill="none" />;
    }
  };

  return (
    <>
      {/* Orecchie (dietro) - devono essere disegnate prima della testa */}
      <ellipse cx="90" cy="130" rx="15" ry="22" fill={skinColor} />
      <ellipse cx="210" cy="130" rx="15" ry="22" fill={skinColor} />
      
      {/* Testa più larga e allungata */}
      <path
        d="M90 130 Q90 60 150 55 Q210 60 210 130 Q210 200 150 205 Q90 200 90 130 Z"
        fill={skinColor}
        stroke="#000"
        strokeWidth="4"
      />
      
      {/* Occhi */}
      <ellipse cx="125" cy="125" rx="6" ry="9" fill="#000" />
      <ellipse cx="175" cy="125" rx="6" ry="9" fill="#000" />
      
      {/* Naso */}
      {renderNose()}
      
      {/* Bocca */}
      <path d="M 135 165 Q 150 175 165 165" stroke="#000" strokeWidth="3" fill="none" />
    </>
  );
}
