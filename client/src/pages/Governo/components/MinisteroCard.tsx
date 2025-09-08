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
      className={`relative w-full h-full rounded-xl shadow-lg overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl bg-white ${
        isWide ? 'col-span-3' : ''
      }`}
      onClick={handleClick}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Barra obliqua colorata in alto */}
      <div 
        className="absolute top-0 left-0 w-full h-1/2 transform -skew-y-1 origin-top-left"
        style={{ backgroundColor: color.bg }}
      >
        <div className="absolute inset-0 flex items-center justify-center transform skew-y-1">
          <IconComponent className={`${isWide ? 'h-8 w-8' : 'h-6 w-6'} text-white`} />
        </div>
      </div>
      
      {/* Parte bianca in basso con testo */}
      <div className="absolute bottom-0 left-0 w-full h-1/2 flex items-center justify-center p-2">
        <div className={`text-gray-800 font-bold text-center leading-tight ${isWide ? 'text-sm' : 'text-xs'}`}>
          {ministero.nome}
        </div>
      </div>
    </button>
  );
};
