import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, Plus, X, Info, CheckCircle2 } from "lucide-react";
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
    <Card className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-xl border-2 border-blue-100/50 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <ThumbsUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Il tuo voto</h2>
              <CardDescription className="text-blue-100 mt-1">
                Puoi votare solo {limit} candidato{limit > 1 ? 'i' : ''} per Capo di Stato. Aggiungi un nome alla tua lista o selezionalo dalla classifica.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              variant={hasReachedLimit ? "destructive" : "secondary"} 
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-semibold ${
                hasReachedLimit 
                  ? "bg-red-500 hover:bg-red-600 text-white" 
                  : "bg-white/20 backdrop-blur-sm text-white border-white/30"
              }`}
            >
              <Info className="h-4 w-4" />
              <span>{currentVotes}/{limit}</span>
            </Badge>
          </div>
        </div>
        {hasReachedLimit && (
          <div className="mt-3 p-3 bg-yellow-500/20 backdrop-blur-sm rounded-lg border border-yellow-300/30">
            <p className="text-yellow-100 font-medium flex items-center">
              <Info className="h-4 w-4 mr-2" />
              Hai già votato. Rimuovi il voto esistente per votarne uno diverso.
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
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

        {selectedVoti.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>I tuoi candidati selezionati:</span>
            </div>
            <div className="grid gap-3">
              {selectedVoti.map((voto) => (
                <div
                  key={voto}
                  className="group relative p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="flex-shrink-0 p-2 bg-green-500 rounded-full">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-green-700 transition-colors">
                          {voto}
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveNome(voto)}
                      className="ml-4 flex-shrink-0 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-300 transform hover:scale-110 shadow-md hover:shadow-xl group/btn"
                      title="Rimuovi voto"
                    >
                      <X className="h-5 w-5 group-hover/btn:rotate-90 transition-transform duration-300" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <ThumbsUp className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">Nessun candidato selezionato</p>
            <p className="text-sm text-gray-500 mt-1">Scegli un candidato dalla classifica per votare</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
