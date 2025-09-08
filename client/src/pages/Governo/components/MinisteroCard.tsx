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
      {/* Barra obliqua colorata - esattamente come in Opinioni */}
      <div 
        className="absolute top-0 left-0 w-1/2 h-full"
        style={{ 
          backgroundColor: color.bg,
          clipPath: 'polygon(0 0, 100% 0, 0 100%)'
        }}
      >
        <div className="absolute top-3 left-3">
          <IconComponent className={`${isWide ? 'h-6 w-6' : 'h-5 w-5'} text-white`} />
        </div>
      </div>
      
      {/* Parte bianca con testo */}
      <div className="absolute bottom-0 right-0 w-1/2 h-full flex flex-col justify-center p-3">
        <div className={`text-gray-800 font-bold leading-tight ${isWide ? 'text-sm' : 'text-xs'}`}>
          {ministero.nome}
        </div>
      </div>
    </button>
  );
};
