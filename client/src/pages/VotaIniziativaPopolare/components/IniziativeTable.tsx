import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp, X, Scale } from "lucide-react";
import { Iniziativa } from "../types";

interface IniziativeTableProps {
  iniziative: Iniziativa[];
  selectedVoti: string[];
  onToggleSelezione: (id: string) => void;
  isBlocked: boolean;
  isPending: boolean;
}

export const IniziativeTable: React.FC<IniziativeTableProps> = ({
  iniziative,
  selectedVoti,
  onToggleSelezione,
  isBlocked,
  isPending
}) => {
  if (!iniziative || iniziative.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ThumbsUp className="h-5 w-5" />
            <span>Iniziative Disponibili</span>
          </CardTitle>
          <CardDescription>Seleziona le iniziative che preferisci</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Scale className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-600">
              Nessuna iniziativa popolare disponibile al momento
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
          <span>Iniziative Disponibili</span>
        </CardTitle>
        <CardDescription>Seleziona le iniziative che preferisci</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {iniziative.map((iniziativa) => {
            const haVotato = selectedVoti.includes(iniziativa.id);
            return (
              <div key={iniziativa.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-all duration-300">
                <div className="flex-1">
                  <span className="font-medium">{iniziativa.nome}</span>
                  {iniziativa.sitoWeb && (
                    <div className="text-sm text-gray-500 mt-1">
                      <a href={iniziativa.sitoWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {iniziativa.sitoWeb}
                      </a>
                    </div>
                  )}
                  <div className="text-sm text-gray-500 mt-1">
                    Quorum: {iniziativa.quorum}
                  </div>
                </div>
                <Button
                  variant={haVotato ? "default" : "outline"}
                  size="sm"
                  onClick={() => onToggleSelezione(iniziativa.id)}
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
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
