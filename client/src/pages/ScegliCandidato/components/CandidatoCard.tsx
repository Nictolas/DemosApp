import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Check } from "lucide-react";
import { CandidatoCardProps } from "../types";
import { apiRequest } from "@/lib/queryClient";

export const CandidatoCard: React.FC<CandidatoCardProps> = ({
  candidato,
  isSelected,
  isSelezionando,
  onSeleziona,
  onViewOpinioni
}) => {
  const [opinioniComuni, setOpinioniComuni] = useState<number>(0);
  const [isLoadingOpinioni, setIsLoadingOpinioni] = useState(false);

  // Funzione per normalizzare le risposte (stessa logica del ViewOpinioniDialog)
  const normalizeAnswer = (answer: string | undefined) => {
    if (!answer || answer === null || answer === undefined) return null;
    if (answer === 'f' || answer === 'c' || answer === 'i') return answer;
    return null;
  };

  // Funzione per determinare se due opinioni sono compatibili
  const isOpinioneComune = (val1: string | undefined, val2: string | undefined) => {
    const normalizedVal1 = normalizeAnswer(val1);
    const normalizedVal2 = normalizeAnswer(val2);
    return (
      normalizedVal1 && normalizedVal2 &&
      normalizedVal1 === normalizedVal2
    );
  };

  // Calcola le opinioni comuni quando il componente si monta
  useEffect(() => {
    const calcolaOpinioniComuni = async () => {
      setIsLoadingOpinioni(true);
      try {
        // Ottieni le opinioni del candidato
        const candidatoResponse = await apiRequest("GET", `/api/users/${candidato.id}/opinioni?grado=E`);
        if (!candidatoResponse.ok) return;
        const candidatoData = await candidatoResponse.json();
        
        // Ottieni le opinioni dell'utente corrente
        const userResponse = await apiRequest("GET", `/api/users/me/opinioni?grado=E`);
        if (!userResponse.ok) return;
        const userData = await userResponse.json();
        
        if (candidatoData.success && userData.success) {
          const candidatoOpinions = candidatoData.data.opinioni || [];
          const userOpinions = userData.data.opinioni || [];
          
          // Crea mappe per confronto rapido
          const candidatoMap: Record<string, string> = {};
          const userMap: Record<string, string> = {};
          
          candidatoOpinions.forEach((opinion: any) => {
            candidatoMap[opinion.id] = opinion.userAnswer;
          });
          
          userOpinions.forEach((opinion: any) => {
            userMap[opinion.id] = opinion.userAnswer;
          });
          
          // Calcola opinioni comuni
          let comuni = 0;
          Object.keys(candidatoMap).forEach(opinionId => {
            if (isOpinioneComune(candidatoMap[opinionId], userMap[opinionId])) {
              comuni++;
            }
          });
          
          setOpinioniComuni(comuni);
          console.log(`🔍 DEBUG CandidatoCard - ${candidato.nome}: ${comuni} opinioni comuni`);
        }
      } catch (error) {
        console.error('Errore nel calcolo opinioni comuni:', error);
        setOpinioniComuni(0);
      } finally {
        setIsLoadingOpinioni(false);
      }
    };
    
    calcolaOpinioniComuni();
  }, [candidato.id, candidato.nome]);

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
        
        {/* Opinion Comuni */}
        <div className="text-center">
          <Badge variant="secondary" className="text-xs">
            {isLoadingOpinioni ? '...' : `${opinioniComuni} opinioni comuni`}
          </Badge>
        </div>
        
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
