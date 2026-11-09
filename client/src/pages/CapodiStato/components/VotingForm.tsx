import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X, CheckCircle2 } from "lucide-react";
import { Classifica } from "../types";

interface VotingFormProps {
  selectedVoti: string[];
  classifica: Classifica[];
  isBlocked: boolean;
  onAddNome: (nome: string) => void;
  onRemoveNome: (nome: string) => void;
  hasReachedLimit: boolean;
}

export const VotingForm: React.FC<VotingFormProps> = ({
  selectedVoti,
  classifica,
  isBlocked,
  onAddNome,
  onRemoveNome,
  hasReachedLimit,
}) => {
  const [nomeInput, setNomeInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const normalizeLabel = (name: string) =>
    name.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("it");
  const existingCandidate = classifica.find(c => normalizeLabel(c.nome) === normalizeLabel(nomeInput));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = nomeInput.trim();
    if (!nomePulito) return;
    
    if (!existingCandidate || isBlocked || hasReachedLimit) return;
    onAddNome(existingCandidate.nome);
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
      <CardContent className="px-3 py-2 lg:px-5 lg:py-3 [@media(max-height:650px)]:py-0.5">
        <form onSubmit={handleSubmit} className="mb-2 [@media(max-height:650px)]:mb-0">
          <div className="w-full">
            <div className="relative min-w-0 flex-1">
              <Input
                placeholder="Nome del candidato..."
                aria-label="Nome del candidato"
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
                      disabled={isBlocked || hasReachedLimit}
                      onClick={() => {
                        if (isBlocked || hasReachedLimit) return;
                        onAddNome(suggestion.nome);
                        setNomeInput("");
                        setShowSuggestions(false);
                      }}
                    >
                      {suggestion.nome} ({suggestion.voti} voti)
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>

        {nomeInput.trim() && !existingCandidate && (
          <p className="mb-2 text-xs text-slate-600">
            Questo nome non è ancora votabile. Per proporlo usa il pulsante Proponi in alto.
          </p>
        )}
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
