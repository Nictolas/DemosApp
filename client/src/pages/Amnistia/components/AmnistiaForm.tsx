import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, Loader2 } from "lucide-react";
import { AmnistiaFormProps } from "../types";

export const AmnistiaForm: React.FC<AmnistiaFormProps> = ({
  limit,
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
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-white lg:px-5 lg:py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold lg:text-lg">Il tuo voto</h2>
          <Badge className="rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-white/20" aria-label={`Voti selezionati: ${mieiVoti.length} su ${limit}`}>
            {mieiVoti.length}/{limit}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 py-2 lg:px-5 lg:py-3">
        <form onSubmit={onSubmit} className="space-y-1">
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
              className="h-11 shrink-0 bg-blue-600 px-3 text-sm text-white hover:bg-blue-700"
              aria-label="Vota per il reato indicato"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Vota"}
            </Button>
          </div>
        </form>

        {mieiVoti && mieiVoti.length > 0 && (
          <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-2 py-1.5 lg:mt-3 lg:px-3 lg:py-2">
            <div className="flex flex-wrap gap-2">
              {mieiVoti.map((voto, index) => (
                <Badge 
                  key={index} 
                  variant="default"
                  className="flex cursor-pointer items-center gap-1 bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                  onClick={() => onRemoveVote(voto)}
                >
                  <X className="h-3.5 w-3.5" />
                  {voto}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
