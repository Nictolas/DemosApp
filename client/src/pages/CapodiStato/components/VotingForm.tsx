import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, CheckCircle2 } from "lucide-react";
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
    <Card className="overflow-hidden rounded-xl border border-blue-100/50 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-sm lg:border-2 lg:shadow-xl lg:h-full lg:min-h-0 lg:flex lg:flex-col">
      <CardHeader className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-white lg:px-5 lg:py-3 [@media(max-height:650px)]:py-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold lg:text-lg">Il tuo voto</h2>
          <Badge className="rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-white/20" aria-label={`Voti selezionati: ${currentVotes} su ${limit}`}>
            {currentVotes}/{limit}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 py-2 lg:px-5 lg:py-3">
        <form onSubmit={handleSubmit} className="mb-2">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                placeholder="Nome del candidato..."
                value={nomeInput}
                onChange={(e) => { 
                  setNomeInput(e.target.value); 
                  setShowSuggestions(true); 
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="h-11 w-full min-w-0 text-base lg:text-sm"
                disabled={isBlocked}
              />
              {showSuggestions && getSuggestions().length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg mt-1">
                  {getSuggestions().map((suggestion) => (
                    <button 
                      key={suggestion.nome} 
                      type="button" 
                      className="min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-gray-100" 
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
              size="icon"
              className="h-11 w-11 shrink-0"
              aria-label="Conferma candidato"
              title="Conferma candidato"
              disabled={!nomeInput.trim() || isBlocked || hasReachedLimit}
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </form>

        {selectedVoti.length > 0 ? (
          <div className="space-y-2 lg:space-y-3">
            <div className="grid gap-2 lg:gap-3">
              {selectedVoti.map((voto) => (
                <div
                  key={voto}
                  className="group relative rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 [@media(max-height:650px)]:py-0 transition-colors hover:border-green-400 lg:px-3 lg:py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3">
                      <div className="shrink-0 rounded-full bg-green-500 p-1.5">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="break-words text-sm font-semibold text-gray-900 lg:text-base">
                          {voto}
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveNome(voto)}
                      className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50"
                      aria-label={`Rimuovi il voto per ${voto}`}
                      title="Rimuovi voto"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="py-1 text-center text-xs text-gray-500 lg:text-sm">Nessun candidato selezionato</p>
        )}
      </CardContent>
    </Card>
  );
};
