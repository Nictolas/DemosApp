import React from "react";
import { User } from "lucide-react";
import { CustomAvatar } from "@/components/CustomAvatar";
import { RappresentantiData, Categoria } from "../types";

interface RappresentanteCardProps {
  categoria: Categoria;
  data: RappresentantiData | undefined;
  onNavigate: (categoriaId: string) => void;
  onOpenOpinioni: (utenteId: string, nome: string, cognome: string, avatarConfig?: string, categoria?: string) => void;
}

export const RappresentanteCard: React.FC<RappresentanteCardProps> = ({
  categoria,
  data,
  onNavigate,
  onOpenOpinioni
}) => {
  const renderRappresentante = (categoriaId: string) => {
    // Controlli di sicurezza per evitare TypeError
    if (!data || !data.rappresentanti || !data.idMap) {
      return (
        <div className="flex flex-col space-y-2 items-center">
          <div className="h-14 w-14 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
            <User className="h-7 w-7 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 italic">Nessuno scelto</p>
          </div>
        </div>
      );
    }
    
    const rappresentanteData = data.rappresentanti[categoriaId];
    const rappresentanteUid = data.idMap[categoriaId];

    let avatarContent;
    if (rappresentanteData && rappresentanteData.avatar_config) {
      try {
        const config = JSON.parse(rappresentanteData.avatar_config);
        avatarContent = <CustomAvatar config={config} size={56} className="w-full h-full" />;
      } catch (e) { /* Fallback to default */ }
    }

    return (
      <div className="flex flex-col space-y-2 items-center">
        <div className="h-14 w-14 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
          {avatarContent || <User className="h-7 w-7 text-gray-400" />}
        </div>
        <div className="text-center">
          {rappresentanteData && rappresentanteData.nome && rappresentanteData.cognome ? (
            <p className="font-medium text-primary cursor-pointer hover:underline text-sm" onClick={(e) => {
                e.stopPropagation(); // Previeni l'apertura del modal di cambio
                if (rappresentanteUid && rappresentanteData) {
                  onOpenOpinioni(rappresentanteUid, rappresentanteData.nome, rappresentanteData.cognome, rappresentanteData.avatar_config, categoriaId);
                }
            }}>
              {`${rappresentanteData.nome} ${rappresentanteData.cognome}`}
            </p>
          ) : (
            <p className="text-sm text-gray-500 italic">Nessuno scelto</p>
          )}
        </div>
      </div>
    );
  };

  const handleClick = () => {
    onNavigate(categoria.id);
  };

  // Mappa colori per le categorie (come nella pagina opinioni)
  const colorMap = { 
    blue: { bg: "#dbeafe", text: "#1e40af", icon: "#2563eb" },
    green: { bg: "#bbf7d0", text: "#166534", icon: "#16a34a" }, 
    purple: { bg: "#ede9fe", text: "#581c87", icon: "#9333ea" }, 
    orange: { bg: "#fef9c3", text: "#92400e", icon: "#ea580c" },
    teal: { bg: "#a7f3d0", text: "#064e3b", icon: "#0d9488" }
  };
  
  const color = colorMap[categoria.color as keyof typeof colorMap] || colorMap.blue;

  return (
    <button
      type="button"
      className="relative w-full h-64 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
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
      <div className="relative z-10 p-4 flex flex-col items-center justify-center">
        <User className="h-8 w-8 mb-2" style={{ color: color.icon }} />
        <div className="text-lg font-bold mb-2 text-center leading-tight" style={{ color: color.text }}>
          {categoria.nome}
        </div>
        {renderRappresentante(categoria.id)}
      </div>
    </button>
  );
};
