import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, Plus, X, Info, CheckCircle2 } from "lucide-react";
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
    <Card className="bg-linear-to-br from-blue-50 via-white to-indigo-50 shadow-xl border-2 border-blue-100/50 overflow-hidden">
      <CardHeader className="bg-linear-to-r from-blue-600 to-indigo-600 text-white pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-xs">
              <ThumbsUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Il tuo voto</h2>
              <CardDescription className="text-blue-100 mt-1">
                Puoi votare solo {limit} richiesta{limit > 1 ? 'e' : ''} di grazia. Aggiungi un nome alla tua lista o selezionalo dalla classifica.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              variant={hasReachedLimit ? "destructive" : "secondary"} 
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-semibold ${
                hasReachedLimit 
                  ? "bg-red-500 hover:bg-red-600 text-white" 
                  : "bg-white/20 backdrop-blur-xs text-white border-white/30"
              }`}
            >
              <Info className="h-4 w-4" />
              <span>{currentVotes}/{limit}</span>
            </Badge>
          </div>
        </div>
        {hasReachedLimit && (
          <div className="mt-3 p-3 bg-yellow-500/20 backdrop-blur-xs rounded-lg border border-yellow-300/30">
            <p className="text-yellow-100 font-medium flex items-center">
              <Info className="h-4 w-4 mr-2" />
              Hai già votato. Rimuovi il voto esistente per votarne uno diverso.
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-4 mb-6">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Nome del carcerato..."
                value={nomeInput}
                onChange={(e) => { 
                  onUpdateField('nomeInput', e.target.value); 
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
            <Button 
              type="submit" 
              disabled={!nomeInput.trim() || isBlocked || isPending || hasReachedLimit}
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
              <span>Le tue richieste selezionate:</span>
            </div>
            <div className="grid gap-3">
              {selectedVoti.map((voto) => (
                <div
                  key={voto}
                  className="group relative p-4 bg-linear-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="shrink-0 p-2 bg-green-500 rounded-full">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-green-700 transition-colors">
                          {voto}
                        </h3>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveLocal(voto)}
                      className="ml-4 shrink-0 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-300 transform hover:scale-110 shadow-md hover:shadow-xl group/btn"
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
            <div className="w-20 h-20 bg-linear-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <ThumbsUp className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">Nessuna richiesta selezionata</p>
            <p className="text-sm text-gray-500 mt-1">Scegli un carcerato dalla classifica per votare</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
