import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, X } from "lucide-react";
import { Referendum } from "../types";

interface UserPreferencesProps {
  selectedVoti: string[];
  referendum: Referendum[];
  onToggleSelezione: (id: string) => void;
}

export const UserPreferences: React.FC<UserPreferencesProps> = ({
  selectedVoti,
  referendum,
  onToggleSelezione
}) => {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ThumbsUp className="h-5 w-5" />
          <span>Le tue preferenze per i referendum abrogativi</span>
        </CardTitle>
        <CardDescription>Vota quali Referendum Abrogativi che hanno raggiunto il quorum dovrebbero avere la priorità ad essere portati alle urne.</CardDescription>
      </CardHeader>
      <CardContent>
        {selectedVoti.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">I tuoi referendum selezionati:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedVoti.map((id) => {
                const referendumItem = referendum.find(r => r.id === id);
                return referendumItem ? (
                  <span key={id} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    <X className="h-3 w-3 mr-1 cursor-pointer" onClick={() => onToggleSelezione(id)} />
                    {referendumItem.nome}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
