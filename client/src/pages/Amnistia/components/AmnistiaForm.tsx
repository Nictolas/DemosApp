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
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>La tua richiesta di amnistia</span>
        </CardTitle>
        <CardDescription>
          Inserisci la legge per cui vuoi chiedere l'amnistia.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Nome della legge..."
                value={leggeInput}
                onChange={(e) => { 
                  onUpdateField('leggeInput', e.target.value); 
                  onShowSuggestions(); 
                }}
                onFocus={onShowSuggestions}
                onBlur={onHideSuggestions}
                className="w-full"
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
            <Button type="submit" disabled={isPending || !leggeInput.trim() || hasReachedLimit}>
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
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Le tue richieste di amnistia:</h4>
            <div className="flex flex-wrap gap-2">
              {mieiVoti.map((voto, index) => (
                <Badge 
                  key={index} 
                  variant="default"
                  className="cursor-pointer hover:bg-destructive/90 transition-colors flex items-center gap-2"
                  onClick={() => onRemoveVote(voto)}
                >
                  <X className="h-3 w-3" />
                  {voto}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Clicca su un nome per rimuovere la richiesta.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
