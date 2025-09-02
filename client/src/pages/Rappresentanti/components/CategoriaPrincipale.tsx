import React from "react";
import { User } from "lucide-react";
import { CustomAvatar } from "@/components/CustomAvatar";
import { RappresentantiData, Categoria } from "../types";

interface CategoriaPrincipaleProps {
  categoria: Categoria;
  data: RappresentantiData | undefined;
  onNavigate: (categoriaId: string) => void;
  onOpenOpinioni: (utenteId: string, nome: string, cognome: string, avatarConfig?: string, categoria?: string) => void;
}

export const CategoriaPrincipale: React.FC<CategoriaPrincipaleProps> = ({
  categoria,
  data,
  onNavigate,
  onOpenOpinioni
}) => {
  const renderRappresentante = (categoriaId: string) => {
    // Controlli di sicurezza per evitare TypeError
    if (!data || !data.rappresentanti || !data.idMap) {
      return (
        <div className="flex flex-col space-y-3 items-center">
          <div className="h-20 w-20 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
            <User className="h-10 w-10 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-gray-500 italic">Nessuno scelto</p>
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
        avatarContent = <CustomAvatar config={config} size={80} className="w-full h-full" />;
      } catch (e) { /* Fallback to default */ }
    }

    return (
      <div className="flex flex-col space-y-3 items-center">
        <div className="h-20 w-20 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
          {avatarContent || <User className="h-10 w-10 text-gray-400" />}
        </div>
        <div className="text-center">
          {rappresentanteData && rappresentanteData.nome && rappresentanteData.cognome ? (
            <p className="font-medium text-primary cursor-pointer hover:underline" onClick={(e) => {
                e.stopPropagation(); // Previeni l'apertura del modal di cambio
                if (rappresentanteUid && rappresentanteData) {
                  onOpenOpinioni(rappresentanteUid, rappresentanteData.nome, rappresentanteData.cognome, rappresentanteData.avatar_config, categoriaId);
                }
            }}>
              {`${rappresentanteData.nome} ${rappresentanteData.cognome}`}
            </p>
          ) : (
            <p className="text-gray-500 italic">Nessuno scelto</p>
          )}
        </div>
      </div>
    );
  };

  const handleClick = () => {
    onNavigate(categoria.id);
  };

  return (
    <button
      type="button"
      className="relative w-full rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform mb-4"
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
        <polygon points="100,0 0,0 0,35 100,20" fill="#dbeafe" />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      <div className="relative z-10 p-6 flex flex-col items-center justify-center">
        <User className="h-12 w-12 text-blue-600 mb-2" />
        <div className="text-2xl font-bold text-blue-800 mb-1">{categoria.nome}</div>
        {renderRappresentante(categoria.id)}
      </div>
    </button>
  );
};
