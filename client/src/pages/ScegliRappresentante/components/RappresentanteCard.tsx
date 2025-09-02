import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomAvatar } from "@/components/CustomAvatar";
import { Loader2, Check, User, ThumbsUp } from "lucide-react";
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

  const handleViewOpinioni = () => {
    onViewOpinioni({
      utenteId: rappresentante.id,
      nome: rappresentante.nome,
      cognome: rappresentante.cognome,
      avatarConfig: rappresentante.avatar_config
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

  return (
    <div className={`relative w-full rounded-2xl shadow-lg overflow-hidden bg-white flex flex-col items-center py-6 px-4 transition-all duration-300 ${isSelected ? 'border-4 border-green-500' : 'border-2 border-transparent'}`}>
      
      {isSelected && <Badge className="absolute top-2 right-2 bg-green-500">Selezionato</Badge>}

      <div 
        className="rounded-full overflow-hidden border-2 border-gray-300 shadow-sm cursor-pointer h-20 w-20 flex items-center justify-center bg-gray-100"
        onClick={handleViewOpinioni}
      >
        {renderAvatar()}
      </div>
      
      <div className="text-center mt-2">
        <p 
          className="font-medium text-primary cursor-pointer hover:underline text-lg" 
          onClick={handleViewOpinioni}
        >
          {rappresentante.nome} {rappresentante.cognome}
        </p>
        <div className="flex justify-center space-x-2 mt-1">
          <Badge variant="secondary">{rappresentante.opinioni_comuni} opinioni comuni</Badge>
        </div>
      </div>
      
      <Button 
        className="w-full mt-4" 
        onClick={() => onSeleziona(rappresentante.id)}
        disabled={isSelezionando || isSelected}
      >
        {renderButtonIcon()}
        {buttonContent.text}
      </Button>
    </div>
  );
};
