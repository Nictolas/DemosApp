import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, X, Info } from "lucide-react";
import { Iniziativa } from "../types";

interface UserPreferencesProps {
  selectedVoti: string[];
  iniziative: Iniziativa[];
  onRemoveVoto: (id: string) => void;
  currentVotes: number;
  limit: number;
  remainingVotes: number;
  hasReachedLimit: boolean;
}

export const UserPreferences: React.FC<UserPreferencesProps> = ({
  selectedVoti,
  iniziative,
  onRemoveVoto,
  currentVotes,
  limit,
  remainingVotes,
  hasReachedLimit
}) => {
  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ThumbsUp className="h-5 w-5" />
            <span className="text-lg font-semibold">Le tue preferenze per le iniziative popolari</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={hasReachedLimit ? "destructive" : "secondary"} className="flex items-center space-x-1">
              <Info className="h-3 w-3" />
              <span>{currentVotes}/{limit}</span>
            </Badge>
          </div>
        </div>
        <CardDescription>
          Puoi votare solo {limit} iniziativa popolare tra quelle disponibili.
          {hasReachedLimit && (
            <span className="block mt-1 text-red-600 font-medium">
              Hai già votato. Rimuovi il voto esistente per votarne una diversa.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {selectedVoti.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Le tue iniziative selezionate:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedVoti.map((id) => {
                const iniziativa = iniziative.find(i => i.id === id);
                return iniziativa ? (
                  <Badge 
                    key={id} 
                    variant="default" 
                    className="cursor-pointer hover:bg-destructive/90 transition-colors flex items-center gap-2" 
                    onClick={() => onRemoveVoto(id)}
                  >
                    <X className="h-3 w-3" />
                    {iniziativa.nome}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
