import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, User, Eye } from "lucide-react";
import { CustomAvatar } from "@/components/CustomAvatar";
import { CandidatoCardProps } from "../types";

export const CandidatoCard: React.FC<CandidatoCardProps> = ({
  candidato,
  isSelected,
  isSelezionando,
  onSeleziona,
  onViewOpinioni
}) => {
  const renderAvatar = () => {
    if (candidato.avatar_config) {
      try {
        const config = JSON.parse(candidato.avatar_config);
        return <CustomAvatar config={config} size={80} className="border-2 border-gray-300 rounded-full shadow-sm" />;
      } catch (e) {
        // Fallback se il parsing fallisce
      }
    }
    
    return (
      <div className="h-20 w-20 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center">
        <User className="h-10 w-10 text-gray-400" />
      </div>
    );
  };

  const renderOpinioni = () => {
    const opinioni = [
      candidato.energia_nucleare,
      candidato.sperimentazione_animale,
      candidato.legalizzazione_canapa,
      candidato.caccia,
      candidato.eutanasia
    ].filter(op => op && op !== 'Indeciso').length;

    return (
      <div className="flex items-center space-x-2">
        <Eye className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-600">{opinioni} opinioni</span>
      </div>
    );
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-lg ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          {renderAvatar()}
        </div>
        <CardTitle className="text-lg">{candidato.nome} {candidato.cognome}</CardTitle>
        <CardDescription>
          <Badge variant="secondary">{candidato.ruolo}</Badge>
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {renderOpinioni()}
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewOpinioni(candidato.id, candidato.nome, candidato.cognome, candidato.avatar_config)}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-1" />
            Opinioni
          </Button>
          
          <Button
            onClick={() => onSeleziona(candidato.id)}
            disabled={isSelezionando || isSelected}
            className={`flex-1 ${isSelected ? 'bg-green-600 hover:bg-green-700' : ''}`}
          >
            {isSelezionando ? (
              "Selezionando..."
            ) : isSelected ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Selezionato
              </>
            ) : (
              "Seleziona"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
