import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle2 } from "lucide-react";
import { Classifica } from "../types";

interface GraziaFormProps {
  nomeInput: string;
  selectedVoti: string[];
  classifica: Classifica[];
  isBlocked: boolean;
  isPending: boolean;
  onUpdateField: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onRemoveLocal: (nome: string) => void;
  hasReachedLimit: boolean;
  currentVotes: number;
  limit: number;
  remainingVotes: number;
}

export const GraziaForm: React.FC<GraziaFormProps> = ({
  nomeInput,
  selectedVoti,
  classifica,
  isBlocked,
  isPending,
  onUpdateField,
  onSubmit,
  onRemoveLocal,
  hasReachedLimit,
  currentVotes,
  limit,
  remainingVotes
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);

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
    <Card className="overflow-hidden rounded-xl border border-blue-100/50 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-sm lg:shadow-xl">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2.5 text-white lg:p-6 lg:pb-4">
        <div className="flex items-start justify-between gap-2 lg:items-center">
          <div className="flex min-w-0 items-start gap-2 lg:items-center lg:gap-3">
            <div className="hidden rounded-lg bg-white/20 p-2 backdrop-blur-sm lg:block">
              <ThumbsUp className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold lg:text-2xl">Il tuo voto</h2>
              <CardDescription className="mt-0.5 text-xs leading-snug text-blue-100 lg:mt-1 lg:text-sm">
                {limit} voto{limit === 1 ? '' : 'i'} disponibile{limit === 1 ? '' : 'i'}. Scegli dalla classifica o cerca tra i nomi già approvati.
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
      </CardHeader>
      <CardContent className="px-3 py-2 lg:px-5 lg:py-3">
        <form onSubmit={onSubmit} className="mb-2 lg:mb-3">
          <div>
            <div className="relative min-w-0 w-full">
              <Input
                placeholder="Cerca nella classifica..."
                enterKeyHint="done"
                aria-label="Cerca un nome per il voto"
                value={nomeInput}
                onChange={(e) => { 
                  onUpdateField('nomeInput', e.target.value); 
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
                        onUpdateField('nomeInput', suggestion.nome); 
                        setShowSuggestions(false); 
                      }}
                    >
                      {suggestion.nome} ({suggestion.richieste} richieste)
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </form>

        {selectedVoti.length > 0 ? (
          <div className="space-y-2 lg:space-y-3">
            <div className="grid gap-2 lg:gap-3">
              {selectedVoti.map((voto) => (
                <div
                  key={voto}
                  className="group relative rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 transition-colors hover:border-green-400 lg:px-3 lg:py-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3">
                      <div className="flex-shrink-0 rounded-full bg-green-500 p-1.5">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="break-words text-sm font-semibold text-gray-900 lg:text-base">
                          {voto}
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveLocal(voto)}
                      className="ml-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50"
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
          <p className="py-1 text-center text-xs text-gray-500 lg:text-sm">Nessuna richiesta selezionata</p>
        )}
      </CardContent>
    </Card>
  );
};
