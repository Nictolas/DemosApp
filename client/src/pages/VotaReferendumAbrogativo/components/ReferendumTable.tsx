import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp, X, Trophy } from "lucide-react";
import { Referendum, Classifica } from "../types";

interface ReferendumTableProps {
  referendum: Referendum[];
  classifica: Classifica[];
  selectedVoti: string[];
  onToggleSelezione: (id: string) => void;
  isBlocked: boolean;
  isPending: boolean;
}

export const ReferendumTable: React.FC<ReferendumTableProps> = ({
  referendum,
  classifica,
  selectedVoti,
  onToggleSelezione,
  isBlocked,
  isPending
}) => {
  if (!referendum || referendum.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ThumbsUp className="h-5 w-5" />
            <span>Referendum Disponibili</span>
          </CardTitle>
          <CardDescription>Seleziona i referendum che preferisci</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <div className="w-20 h-20 bg-linear-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Trophy className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-600">
              Nessun referendum abrogativo disponibile al momento
            </p>
            <p className="text-sm text-gray-500 mt-2">Riprova più tardi</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ThumbsUp className="h-5 w-5" />
          <span>Referendum Disponibili</span>
        </CardTitle>
        <CardDescription>Seleziona i referendum che preferisci</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {referendum.map((ref) => {
            const haVotato = selectedVoti.includes(ref.id);
            return (
              <div key={ref.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-all duration-300">
                <div className="flex-1">
                  <span className="font-medium">{ref.nome}</span>
                  {ref.data_inizio && ref.data_fine && (
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(ref.data_inizio).toLocaleDateString('it-IT')} - {new Date(ref.data_fine).toLocaleDateString('it-IT')}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">
                    {classifica.find(c => c.nome === ref.nome)?.voti || 0} voti
                  </span>
                  <Button
                    variant={haVotato ? "default" : "outline-solid"}
                    size="sm"
                    onClick={() => onToggleSelezione(ref.id)}
                    disabled={isPending || isBlocked}
                    className={haVotato ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    {haVotato ? (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Selezionato
                      </>
                    ) : (
                      <>
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Seleziona
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
