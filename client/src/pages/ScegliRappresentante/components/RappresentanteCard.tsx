import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomAvatar } from "@/components/CustomAvatar";
import { Loader2, Check, User, ThumbsUp, Users } from "lucide-react";
import { RappresentanteCardProps } from "../types";
import { getAvatarContent, getButtonContent } from "../utils/rappresentanteUtils";

export const RappresentanteCard: React.FC<RappresentanteCardProps> = ({
  rappresentante,
  isSelected,
  isSelezionando,
  onSeleziona,
  onViewOpinioni
}) => {
  const buttonContent = getButtonContent(isSelected, isSelezionando);
  const avatarConfig = getAvatarContent(rappresentante.avatar_config);
  const compatibility = rappresentante.compatibilita_percentuale ?? rappresentante.compatibilitaPercentuale ?? 0;
  const coverageKnown = rappresentante.copertura_posizioni ?? rappresentante.coperturaPosizioni ?? 0;
  const coverageTotal = rappresentante.copertura_totale ?? rappresentante.coperturaTotale ?? 0;

  const handleViewOpinioni = () => {
    const data = {
      utenteId: rappresentante.id,
      nome: rappresentante.nome,
      cognome: rappresentante.cognome,
      avatarConfig: rappresentante.avatar_config
    };
    console.log('🔍 DEBUG RappresentanteCard - handleViewOpinioni chiamato con data:', data);
    onViewOpinioni(data);
  };

  const renderAvatar = () => {
    if (avatarConfig) {
      return (
        <CustomAvatar 
          config={avatarConfig}
          size={80}
          className="w-full h-full"
        />
      );
    }
    return <User className="h-10 w-10 text-gray-400" />;
  };

  const renderButtonIcon = () => {
    if (isSelezionando) {
      return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    }
    if (isSelected) {
      return <Check className="mr-2 h-4 w-4" />;
    }
    return <ThumbsUp className="mr-2 h-4 w-4" />;
  };

  // Colori per l'estetica europea (blu)
  const colorMap = { 
    bg: "#dbeafe", 
    text: "#1e40af", 
    icon: "#2563eb",
    button: "#2563eb",
    buttonHover: "#1d4ed8"
  };

  return (
    <div className={`relative w-full h-full min-h-72 rounded-2xl shadow-lg overflow-hidden transition-all duration-300 ${isSelected ? 'border-4 border-green-500' : 'border-2 border-transparent'}`}>
      
      {/* SVG con forme geometriche colorate come nella pagina opinioni */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="100,0 0,0 0,35 100,20" fill={colorMap.bg} />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      
      {isSelected && <Badge className="absolute top-2 right-2 bg-green-500 z-20">Selezionato</Badge>}

      <div className="relative z-10 p-4 md:p-6 flex flex-col items-center justify-center h-full">
        {/* Icona colorata come nella pagina opinioni */}
        <Users className="h-8 md:h-10 w-8 md:w-10 mb-3" style={{ color: colorMap.icon }} />
        
        <div 
          className="rounded-full overflow-hidden border-2 border-gray-300 shadow-sm cursor-pointer h-16 w-16 flex items-center justify-center bg-white mb-3"
          onClick={handleViewOpinioni}
        >
          {renderAvatar()}
        </div>
        
        <div className="text-center mb-3">
          <p 
            className="font-bold cursor-pointer hover:underline text-lg mb-1" 
            style={{ color: colorMap.text }}
            onClick={handleViewOpinioni}
          >
            {rappresentante.nome} {rappresentante.cognome}
          </p>
          <div className="flex flex-col items-center gap-1">
            <Badge 
              variant="secondary" 
              className="text-xs"
              style={{ backgroundColor: colorMap.bg, color: colorMap.text }}
            >
              {compatibility}% compatibilità
            </Badge>
            <span className="text-xs text-gray-500">
              {coverageKnown}/{coverageTotal} posizioni disponibili
            </span>
          </div>
        </div>
        
        <Button 
          className="w-full" 
          onClick={() => onSeleziona(rappresentante.id)}
          disabled={isSelezionando || isSelected}
          style={{ 
            backgroundColor: isSelected ? '#16a34a' : colorMap.button,
            color: 'white'
          }}
          onMouseEnter={(e) => {
            if (!isSelected && !isSelezionando) {
              e.currentTarget.style.backgroundColor = colorMap.buttonHover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected && !isSelezionando) {
              e.currentTarget.style.backgroundColor = colorMap.button;
            }
          }}
        >
          {renderButtonIcon()}
          {buttonContent.text}
        </Button>
      </div>
    </div>
  );
};
