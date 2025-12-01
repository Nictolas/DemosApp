import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Vote, Plus, X, Info } from "lucide-react";
import { Classifica } from "../types";

interface VotingFormProps {
  selectedVoti: string[];
  classifica: Classifica[];
  isBlocked: boolean;
  onAddNome: (nome: string) => void;
  onRemoveNome: (nome: string) => void;
  hasReachedLimit: boolean;
  currentVotes: number;
  limit: number;
  remainingVotes: number;
}

export const VotingForm: React.FC<VotingFormProps> = ({
  selectedVoti,
  classifica,
  isBlocked,
  onAddNome,
  onRemoveNome,
  hasReachedLimit,
  currentVotes,
  limit,
  remainingVotes
}) => {
  const [nomeInput, setNomeInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = nomeInput.trim();
    if (!nomePulito) return;
    
    onAddNome(nomePulito);
    setNomeInput("");
  };

  const getSuggestions = () => {
    if (!nomeInput.trim() || !showSuggestions) return [];
    return classifica
      .filter(item => 
        item.nome.toLowerCase().includes(nomeInput.toLowerCase()) && 
        item.nome.toLowerCase() !== nomeInput.toLowerCase()
      )
      .slice(0, 5);
  };

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Vote className="h-5 w-5" />
            <span className="text-lg font-semibold">Il tuo voto</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={hasReachedLimit ? "destructive" : "secondary"} className="flex items-center space-x-1">
              <Info className="h-3 w-3" />
              <span>{currentVotes}/{limit}</span>
            </Badge>
          </div>
        </div>
        <CardDescription>
          Puoi votare solo {limit} candidato per Capo di Stato. Aggiungi un nome alla tua lista o selezionalo dalla classifica.
          {hasReachedLimit && (
            <span className="block mt-1 text-red-600 font-medium">
              Hai già votato. Rimuovi il voto esistente per votarne uno diverso.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Nome del candidato..."
                value={nomeInput}
                onChange={(e) => { 
                  setNomeInput(e.target.value); 
                  setShowSuggestions(true); 
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full"
                disabled={isBlocked}
              />
              {showSuggestions && getSuggestions().length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg mt-1">
                  {getSuggestions().map((suggestion) => (
                    <button 
                      key={suggestion.nome} 
                      type="button" 
                      className="w-full text-left px-3 py-2 hover:bg-gray-100" 
                      onClick={() => { 
                        setNomeInput(suggestion.nome); 
                        setShowSuggestions(false); 
                      }}
                    >
                      {suggestion.nome} ({suggestion.voti} voti)
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button 
              type="submit" 
              disabled={!nomeInput.trim() || isBlocked}
            >
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi
            </Button>
          </div>
        </form>

        {selectedVoti.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Voti selezionati:</h4>
              <p className="text-xs text-gray-500">
                {selectedVoti.length}/{limit} candidato{limit > 1 ? 'i' : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedVoti.map((voto) => (
                <Badge 
                  key={voto} 
                  variant="default" 
                  className="cursor-pointer hover:bg-destructive/90 transition-colors flex items-center gap-2" 
                  onClick={() => onRemoveNome(voto)}
                >
                  <X className="h-3 w-3" />
                  {voto}
                </Badge>
              ))}
            </div>
            {selectedVoti.length >= limit && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ Hai raggiunto il limite massimo di {limit} voto{limit > 1 ? 'i' : ''}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
