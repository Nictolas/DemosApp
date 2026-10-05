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
    <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <CardTitle className="flex items-center space-x-2 text-xl">
          <div className="p-2 bg-linear-to-br from-blue-500 to-indigo-600 rounded-lg">
            <Plus className="h-5 w-5 text-white" />
          </div>
          <span className="bg-linear-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent font-bold">
            La tua richiesta di amnistia
          </span>
        </CardTitle>
        <CardDescription className="text-gray-600 mt-2">
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
            <Button 
              type="submit" 
              disabled={isPending || !leggeInput.trim() || hasReachedLimit}
              className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200"
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
          <div className="mt-6 p-4 bg-linear-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <h4 className="text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Le tue richieste di amnistia:
            </h4>
            <div className="flex flex-wrap gap-2">
              {mieiVoti.map((voto, index) => (
                <Badge 
                  key={index} 
                  variant="default"
                  className="cursor-pointer bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 px-3 py-1.5"
                  onClick={() => onRemoveVote(voto)}
                >
                  <X className="h-3.5 w-3.5" />
                  {voto}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2 italic">
              Clicca su un nome per rimuovere la richiesta.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
