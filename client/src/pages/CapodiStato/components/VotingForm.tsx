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
  const [searchError, setSearchError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = nomeInput.trim();
    if (!nomePulito) return;
    // Il voto non crea nuovi candidati: il nome deve già comparire nella lista.
    const candidate = classifica.find(item => item.nome.toLocaleLowerCase('it') === nomePulito.toLocaleLowerCase('it'));
    if (!candidate) {
      setSearchError("Puoi votare soltanto candidati già presenti nella classifica.");
      return;
    }
    setSearchError("");
    onAddNome(candidate.nome);
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
      <CardHeader className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-2 py-1.5 text-white lg:px-6 lg:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2 lg:items-center lg:gap-3">
            <div className="hidden shrink-0 rounded-lg bg-white/20 p-2 backdrop-blur-sm lg:block lg:p-1.5">
              <ThumbsUp className="h-6 w-6 lg:h-4 lg:w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold lg:text-2xl lg:text-lg">Il tuo voto</h2>
              <CardDescription className="sr-only lg:not-sr-only lg:mt-0.5 lg:text-xs lg:leading-snug lg:text-blue-100">
                Scegli dalla classifica o cerca un nome già presente. Massimo {limit} voto{limit !== 1 ? 'i' : ''}.
              </CardDescription>
            </div>
          </div>
          <div className="shrink-0">
            <Badge 
              variant={hasReachedLimit ? "destructive" : "secondary"} 
              className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold lg:gap-1.5 lg:px-3 lg:py-1.5 lg:text-sm ${
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
          <div className="mt-2 hidden rounded-lg border border-yellow-300/30 bg-yellow-500/20 p-2 backdrop-blur-sm lg:block lg:mt-3 lg:p-3">
            <p className="flex items-center text-xs font-medium leading-snug text-yellow-100 lg:text-sm">
              <Info className="h-4 w-4 mr-2" />
              Hai già votato. Rimuovi il voto esistente per votarne uno diverso.
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-2 pb-1 pt-1 lg:px-6 lg:pb-3 lg:pt-3">
        <form onSubmit={handleSubmit} className="mb-0 space-y-1 lg:mb-3 lg:space-y-2">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                placeholder="Cerca tra i candidati..."
                value={nomeInput}
                onChange={(e) => { 
                  setNomeInput(e.target.value);
                  setSearchError("");
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
              className="h-11 shrink-0 px-3 text-sm lg:px-4"
              disabled={!nomeInput.trim() || isBlocked || hasReachedLimit}
            >
              <Plus className="mr-1 h-4 w-4 lg:mr-2" />
              Aggiungi
            </Button>
          </div>
          {searchError && <p role="alert" className="text-xs text-red-700">{searchError}</p>}
        </form>

        {selectedVoti.length > 0 ? (
          <div className="space-y-2 lg:space-y-3">
            <div className="mb-2 hidden items-center gap-2 text-xs font-semibold text-gray-700 lg:flex lg:mb-3 lg:text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Il tuo Presidente della Repubblica ideale:</span>
            </div>
            <div className="grid gap-2 lg:gap-3">
              {selectedVoti.map((voto) => (
                <div
                  key={voto}
                  className="group relative rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-2.5 shadow-sm transition-colors hover:border-green-400 lg:border-2 lg:p-4 lg:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3">
                      <div className="shrink-0 rounded-full bg-green-500 p-1.5 lg:p-2">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="break-words text-sm font-bold text-gray-900 transition-colors group-hover:text-green-700 lg:text-lg">
                          {voto}
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveNome(voto)}
                      className="group/btn ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600 lg:ml-4"
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
          <div className="hidden rounded-lg bg-white/60 px-2 py-2 text-center lg:block lg:py-3">
            <div className="mx-auto mb-4 hidden h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-300 lg:flex lg:mb-2 lg:h-12 lg:w-12">
              <ThumbsUp className="h-10 w-10 text-gray-400 lg:h-6 lg:w-6" />
            </div>
            <p className="text-xs text-gray-600 lg:text-base lg:font-medium lg:text-sm">Nessun candidato selezionato</p>
            <p className="mt-1 hidden text-sm text-gray-500 lg:block lg:text-xs">Scegli un candidato dalla classifica per votare</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
