import React from "react";
import { AvatarFace } from "./AvatarFace";
import { AvatarHair } from "./AvatarHair";
import { AvatarFacialHair } from "./AvatarFacialHair";
import { AvatarGlasses } from "./AvatarGlasses";
import { AvatarClothing } from "./AvatarClothing";
import { useAvatarPositioning } from "./useAvatarPositioning";

interface AvatarConfig {
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  mustacheStyle: string;
  mustacheColor: string;
  beardStyle: string;
  beardColor: string;
  noseStyle: string;
  suitColor: string;
  tieColor: string;
  glassesStyle: string;
  glassesColor: string;
}

interface CustomAvatarProps {
  config: AvatarConfig | null;
  size?: number;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const defaultConfig: AvatarConfig = {
  skinColor: "#FDBCB4",
  hairColor: "#8B4513",
  hairStyle: "short",
  mustacheStyle: "none",
  mustacheColor: "#2C1810",
  beardStyle: "none",
  beardColor: "#2C1810",
  noseStyle: "normal",
  suitColor: "#2C3E50",
  tieColor: "#E74C3C",
  glassesStyle: "none",
  glassesColor: "#333333"
};

export function CustomAvatar({ config, size = 100, className = "rounded-full", onClick }: CustomAvatarProps) {
  const avatarConfig = config || defaultConfig;
  const { darkenColor } = useAvatarPositioning();

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 300 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* Mascheramento circolare per nascondere gli angoli dell'avatar */}
        <defs>
          <clipPath id="circleClip">
            <circle cx="150" cy="150" r="145"/>
          </clipPath>
        </defs>
        
        {/* Cerchio azzurro di sfondo */}
        <circle cx="150" cy="150" r="145" fill="#38BDF8"/>
        
        {/* Applico il clipping circolare a tutto l'avatar */}
        <g clipPath="url(#circleClip)">
          {/* Abbigliamento (dietro) */}
          <AvatarClothing 
            suitColor={avatarConfig.suitColor}
            tieColor={avatarConfig.tieColor}
            skinColor={avatarConfig.skinColor}
          />
          
          {/* Faccia base (testa, occhi, naso, bocca, orecchie, collo) */}
          <AvatarFace 
            skinColor={avatarConfig.skinColor}
            noseStyle={avatarConfig.noseStyle}
          />
          
          {/* Capelli */}
          <AvatarHair 
            hairStyle={avatarConfig.hairStyle}
            hairColor={avatarConfig.hairColor}
            darkenColor={darkenColor}
          />
          
          {/* Baffi e barba */}
          <AvatarFacialHair 
            mustacheStyle={avatarConfig.mustacheStyle}
            mustacheColor={avatarConfig.mustacheColor}
            beardStyle={avatarConfig.beardStyle}
            beardColor={avatarConfig.beardColor}
          />

          {/* Occhiali - sempre in primo piano */}
          <AvatarGlasses 
            glassesStyle={avatarConfig.glassesStyle} 
            glassesColor={avatarConfig.glassesColor}
          />
        </g>
      </svg>
    </div>
  );
}
