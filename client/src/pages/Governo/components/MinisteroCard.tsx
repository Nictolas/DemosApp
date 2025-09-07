import React from "react";
import { useLocation } from "wouter";
import { colorMap } from "../constants/ministeri";
import { MinisteroCardProps } from "../types";

export const MinisteroCard: React.FC<MinisteroCardProps> = ({
  ministero,
  data,
  onNavigate
}) => {
  const [, setLocation] = useLocation();
  const IconComponent = ministero.icon;
  
  const handleClick = () => {
    setLocation(`/governo/${ministero.slug}`);
  };

  const color = colorMap[ministero.color as keyof typeof colorMap] || colorMap.blue;

  // Ottieni i dati per questo ministero
  const classifiche = data?.classifiche?.[ministero.categoria] || [];
  const mieiVoti = data?.mieiVoti?.[ministero.categoria] || [];
  
  const piuVotato = classifiche.length > 0 ? classifiche[0] : null;
  const mioVoto = mieiVoti.length > 0 ? mieiVoti[0] : null;

  return (
    <button
      type="button"
      className="relative w-full h-60 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
      onMouseDown={(e) => {
        e.currentTarget.classList.add('scale-95', 'shadow-md');
      }}
      onMouseUp={(e) => {
        e.currentTarget.classList.remove('scale-95', 'shadow-md');
        setTimeout(handleClick, 100);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.classList.remove('scale-95', 'shadow-md');
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        e.currentTarget.classList.add('scale-95', 'shadow-md');
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('scale-95', 'shadow-md');
        setTimeout(handleClick, 100);
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points="100,0 0,0 0,35 100,20" fill={color.bg} />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      <div className="relative z-10 p-4 flex flex-col items-center justify-center h-full">
        <IconComponent className="h-8 w-8 mb-2" style={{ color: color.icon }} />
        <div className="text-lg font-bold mb-3 text-center leading-tight" style={{ color: color.text }}>
          {ministero.nome}
        </div>
        
        {/* Il Più Votato */}
        <div className="text-xs text-center mb-2">
          <div className="font-semibold text-gray-600">Il Più Votato</div>
          <div className="text-gray-800 font-medium">
            {piuVotato ? `${piuVotato.nome} (${piuVotato.voti})` : 'Nessun voto'}
          </div>
        </div>
        
        {/* Il Tuo Voto */}
        <div className="text-xs text-center">
          <div className="font-semibold text-gray-600">Il Tuo Voto</div>
          <div className="text-gray-800 font-medium">
            {mioVoto ? mioVoto : 'Non votato'}
          </div>
        </div>
      </div>
    </button>
  );
};
