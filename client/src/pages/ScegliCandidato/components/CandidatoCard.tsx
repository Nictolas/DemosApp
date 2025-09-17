import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Check } from "lucide-react";
import { CandidatoCardProps } from "../types";

export const CandidatoCard: React.FC<CandidatoCardProps> = ({
  candidato,
  isSelected,
  isSelezionando,
  onSeleziona,
  onViewOpinioni
}) => {
  const handleSeleziona = () => {
    onSeleziona(candidato.id);
  };

  const handleViewOpinioni = () => {
    onViewOpinioni({
      utenteId: candidato.id,
      nome: candidato.nome,
      cognome: candidato.cognome,
      avatarConfig: candidato.avatarConfig,
      categoria: candidato.grado_candidatura
    });
  };

  return (
    <Card className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
      isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
    }`}>
      <div className="flex flex-col items-center text-center space-y-3">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xl font-bold">
          {candidato.nome?.charAt(0) || 'C'}
        </div>
        
        {/* Nome e cognome */}
        <div>
          <h3 className="font-semibold text-lg">
            {candidato.nome} {candidato.cognome}
          </h3>
          <p className="text-sm text-gray-600">{candidato.email}</p>
        </div>
        
        {/* Ruolo */}
        <Badge variant="secondary" className="text-xs">
          {candidato.ruolo}
        </Badge>
        
        {/* Pulsanti */}
        <div className="flex space-x-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewOpinioni}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-1" />
            Opinioni
          </Button>
          
          <Button
            onClick={handleSeleziona}
            disabled={isSelezionando || isSelected}
            className={`flex-1 ${
              isSelected ? 'bg-green-500 hover:bg-green-600' : ''
            }`}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Selezionato
              </>
            ) : (
              'Scegli'
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
