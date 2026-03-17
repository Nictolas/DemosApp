import React from "react";
import { useLocation } from "wouter";
import { colorMap } from "../constants/ministeri";
import { MinisteroCardProps } from "../types";

export const MinisteroCard: React.FC<MinisteroCardProps> = ({
  ministero,
  data,
  onNavigate,
  onOpenModal,
  isWide = false
}) => {
  const IconComponent = ministero.icon;
  
  const handleClick = () => {
    onOpenModal(ministero);
  };

  const color = colorMap[ministero.color as keyof typeof colorMap] || colorMap.blue;

  // Ottieni i dati per questo ministero
  const classifiche = data?.classifiche?.[ministero.categoria] || [];
  const mioVoto = data?.mieiVoti?.[ministero.categoria];
  
  const piuVotato = classifiche.length > 0 ? classifiche[0] : null;

  return (
    <button
      type="button"
      className={`ministero-card relative w-full rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform ${
        isWide ? 'col-span-3' : ''
      }`}
      onClick={handleClick}
      onContextMenu={e => e.preventDefault()}
    >
      {/* SVG con poligoni - esattamente come in Vota */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="100,0 0,0 0,35 100,20" fill={color.bg} />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      
      {/* Contenuto */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <span className="relative flex items-center justify-center w-12 h-12 mb-2">
          <IconComponent className={`h-10 w-10 text-white absolute`} style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
          <IconComponent className={`h-6 w-6 ${color.text} relative z-10`} />
        </span>
        <div className={`text-gray-700 font-semibold select-none ${isWide ? 'text-base' : 'text-sm'}`}>
          {ministero.nome}
        </div>
      </div>
    </button>
  );
};
