import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomAvatar } from "@/components/CustomAvatar";
import { Loader2, Check, User, ThumbsUp, Users } from "lucide-react";
import { CandidatoCardProps } from "../types";
import { getAvatarContent, getButtonContent } from "../utils/candidatoUtils";

export const CandidatoCard: React.FC<CandidatoCardProps> = ({
  candidato,
  isSelected,
  isSelezionando,
  onSeleziona,
  onViewOpinioni
}) => {
  const buttonContent = getButtonContent(isSelected, isSelezionando);
  const avatarConfig = getAvatarContent(candidato.avatar_config);

  const handleViewOpinioni = () => {
    onViewOpinioni({
      utenteId: candidato.id,
      nome: candidato.nome,
      cognome: candidato.cognome,
      avatarConfig: candidato.avatar_config
    });
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
    <div className={`relative w-full h-full min-h-72 rounded-2xl shadow-lg overflow-hidden transition-all duration-300 
      ${isSelected ? 'ring-2 ring-blue-500 scale-105' : 'hover:scale-105'} 
      ${isSelezionando ? 'opacity-75' : ''}`}
      style={{ backgroundColor: colorMap.bg }}>
      
      {/* Header con gradiente */}
      <div className="h-20 flex items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 opacity-90"></div>
        <div className="relative z-10 text-center">
          <h3 className="text-lg font-bold text-white">
            {candidato.nome} {candidato.cognome}
          </h3>
          <p className="text-sm text-blue-100">{candidato.ruolo}</p>
        </div>
      </div>

      {/* Avatar */}
      <div className="flex justify-center -mt-10 relative z-20">
        <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg bg-white flex items-center justify-center overflow-hidden">
          {renderAvatar()}
        </div>
      </div>

      {/* Contenuto principale */}
      <div className="p-4 pt-6 text-center">
        <div className="mb-4">
          <Badge variant="secondary" className="mb-2">
            <Users className="w-3 h-3 mr-1" />
            {candidato.opinioni_comuni} opinioni comuni
          </Badge>
        </div>

        {/* Pulsante azione */}
        <Button
          onClick={() => onSeleziona(candidato.id)}
          disabled={isSelezionando || isSelected}
          className={`w-full mb-3 ${
            isSelected 
              ? 'bg-green-600 hover:bg-green-700 text-white' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {renderButtonIcon()}
          {buttonContent.text}
        </Button>

        {/* Pulsante opinioni */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleViewOpinioni}
          className="w-full"
        >
          Vedi Opinioni
        </Button>
      </div>
    </div>
  );
};