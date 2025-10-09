import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, X } from "lucide-react";
import { Iniziativa } from "../types";

interface UserPreferencesProps {
  selectedVoti: string[];
  iniziative: Iniziativa[];
  onRemoveVoto: (id: string) => void;
}

export const UserPreferences: React.FC<UserPreferencesProps> = ({
  selectedVoti,
  iniziative,
  onRemoveVoto
}) => {
  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ThumbsUp className="h-5 w-5" />
          <span>Le tue preferenze per le iniziative popolari</span>
        </CardTitle>
        <CardDescription>Seleziona le iniziative che preferisci.</CardDescription>
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
