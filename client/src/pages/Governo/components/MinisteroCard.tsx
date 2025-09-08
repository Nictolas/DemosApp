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
      className={`relative w-full rounded-xl shadow-lg overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl ${
        isWide ? 'col-span-3 aspect-[3/1]' : 'aspect-square'
      }`}
      onClick={handleClick}
      onContextMenu={e => e.preventDefault()}
    >
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center p-3"
        style={{ background: `linear-gradient(135deg, ${color.bg} 0%, ${color.bg}dd 100%)` }}
      >
        <IconComponent className={`${isWide ? 'h-12 w-12' : 'h-8 w-8'} mb-2 text-white`} />
        <div className={`text-white font-bold text-center leading-tight ${isWide ? 'text-lg' : 'text-sm'}`}>
          {ministero.nome}
        </div>
      </div>
    </button>
  );
};
