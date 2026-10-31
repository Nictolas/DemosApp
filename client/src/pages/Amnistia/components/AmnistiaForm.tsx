import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, X, Loader2 } from "lucide-react";
import { AmnistiaFormProps } from "../types";

export const AmnistiaForm: React.FC<AmnistiaFormProps> = ({
  leggeInput,
  showSuggestions,
  mieiVoti,
  suggestions,
  isPending,
  onUpdateField,
  onSubmit,
  onRemoveVote,
  onSelectSuggestion,
  onShowSuggestions,
  onHideSuggestions,
  hasReachedLimit
}) => {
  return (
    <Card className="overflow-hidden border border-blue-100/50 bg-white shadow-sm">
      <CardHeader className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-2 py-1.5 lg:p-5">
        <CardTitle className="flex items-center gap-2 text-sm lg:text-xl">
          <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-1 lg:p-2">
            <Plus className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent font-bold">
            La tua richiesta di amnistia
          </span>
        </CardTitle>
        <CardDescription className="sr-only lg:not-sr-only lg:mt-2 lg:text-gray-600">
          Inserisci il reato per cui vuoi chiedere l'amnistia.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-2 pt-1 lg:px-6 lg:pb-5 lg:pt-4">
        <form onSubmit={onSubmit} className="space-y-2 lg:space-y-4">
          <div className="flex min-w-0 gap-1 lg:gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                placeholder="Nome del reato..."
                value={leggeInput}
                onChange={(e) => { 
                  onUpdateField('leggeInput', e.target.value); 
                  onShowSuggestions(); 
                }}
                onFocus={onShowSuggestions}
                onBlur={onHideSuggestions}
                className="h-11 min-w-0 w-full text-base"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg mt-1">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 border-b border-gray-100 last:border-b-0"
                      onClick={() => onSelectSuggestion(suggestion.legge)}
                    >
                      {suggestion.legge} ({suggestion.voti} voti)
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button 
              type="submit" 
              disabled={isPending || !leggeInput.trim() || hasReachedLimit}
              className="h-11 shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-2 text-xs text-white hover:from-blue-700 hover:to-indigo-700 lg:px-4 lg:text-base"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Vota Amnistia
            </Button>
          </div>
        </form>

        {mieiVoti && mieiVoti.length > 0 && (
          <div className="mt-2 rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-2 py-1 lg:mt-6 lg:p-4">
            <h4 className="mb-1 hidden items-center gap-2 text-xs font-semibold text-gray-700 lg:mb-3 lg:flex lg:text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Le tue richieste di amnistia:
            </h4>
            <div className="flex flex-wrap gap-2">
              {mieiVoti.map((voto, index) => (
                <Badge 
                  key={index} 
                  variant="default"
                  className="flex cursor-pointer items-center gap-1 bg-gradient-to-r from-green-600 to-emerald-600 px-2 py-1 text-xs text-white shadow-sm hover:from-green-700 hover:to-emerald-700 lg:gap-2 lg:px-3 lg:py-1.5"
                  onClick={() => onRemoveVote(voto)}
                >
                  <X className="h-3.5 w-3.5" />
                  {voto}
                </Badge>
              ))}
            </div>
            <p className="hidden text-xs italic text-gray-600 lg:mt-2 lg:block">
              Clicca su un reato per rimuovere la richiesta.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
