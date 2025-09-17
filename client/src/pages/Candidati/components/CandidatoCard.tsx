import React from "react";
import { User } from "lucide-react";
import { CustomAvatar } from "@/components/CustomAvatar";
import { CandidatiData, Categoria } from "../types";

interface CandidatoCardProps {
  categoria: Categoria;
  data: CandidatiData | undefined;
  onNavigate: (categoriaId: string) => void;
  onOpenOpinioni: (utenteId: string, nome: string, cognome: string, avatarConfig?: string, categoria?: string) => void;
}

export const CandidatoCard: React.FC<CandidatoCardProps> = ({
  categoria,
  data,
  onNavigate,
  onOpenOpinioni
}) => {
  const renderCandidato = (categoriaId: string) => {
    // Controlli di sicurezza per evitare TypeError
    if (!data || !data.candidati || !data.idMap) {
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
    
    // La nuova struttura dell'API restituisce candidati per categoria come array
    const candidatiPerCategoria = data.candidati[categoriaId];
    let candidatoData = null;
    let candidatoUid = null;
    
    if (candidatiPerCategoria && Array.isArray(candidatiPerCategoria) && candidatiPerCategoria.length > 0) {
      candidatoData = candidatiPerCategoria[0]; // Prendi il primo (e unico) candidato
      candidatoUid = candidatoData.id;
      
      console.log(`🔍 DEBUG CandidatoCard - Candidato trovato per ${categoriaId}:`, candidatoData);
    } else {
      console.log(`🔍 DEBUG CandidatoCard - Nessun candidato per ${categoriaId}:`, candidatiPerCategoria);
    }

    let avatarContent;
    if (candidatoData && candidatoData.avatar_config) {
      try {
        // Gestisci il caso di doppia serializzazione JSON
        let config;
        if (typeof candidatoData.avatar_config === 'string') {
          // Prima prova a fare il parse diretto
          config = JSON.parse(candidatoData.avatar_config);
          // Se il risultato è ancora una stringa, fai un secondo parse
          if (typeof config === 'string') {
            config = JSON.parse(config);
          }
        } else {
          config = candidatoData.avatar_config;
        }
        avatarContent = <CustomAvatar config={config} size={56} className="w-full h-full" />;
        console.log(`🔍 DEBUG CandidatoCard - Avatar config per ${categoriaId}:`, config);
      } catch (e) { 
        console.log(`⚠️ DEBUG CandidatoCard - Errore parsing avatar per ${categoriaId}:`, e);
      }
    }

    return (
      <div className="flex flex-col space-y-2 items-center">
        <div className="h-14 w-14 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
          {avatarContent || <User className="h-7 w-7 text-gray-400" />}
        </div>
        <div className="text-center">
          {candidatoData && candidatoData.nome && candidatoData.cognome ? (
            <p className="font-medium text-primary cursor-pointer hover:underline text-sm" onClick={(e) => {
                e.stopPropagation(); // Previeni l'apertura del modal di cambio
                if (candidatoUid && candidatoData) {
                  onOpenOpinioni(candidatoUid, candidatoData.nome, candidatoData.cognome, candidatoData.avatar_config, categoriaId);
                }
            }}>
              {`${candidatoData.nome} ${candidatoData.cognome}`}
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
      <div className="relative z-10 p-4 flex flex-col items-center justify-center">
        <User className="h-8 w-8 mb-2" style={{ color: color.icon }} />
        <div className="text-lg font-bold mb-2 text-center leading-tight" style={{ color: color.text }}>
          {categoria.nome}
        </div>
        {renderCandidato(categoria.id)}
      </div>
    </button>
  );
};
