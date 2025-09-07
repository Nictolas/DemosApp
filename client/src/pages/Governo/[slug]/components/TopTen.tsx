import React from "react";
import { Trophy, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopTenProps } from "../types";

export const TopTen: React.FC<TopTenProps> = ({
  classifiche,
  selectedVoti,
  onToggleSelezione,
  showAllClassifica
}) => {
  const topTen = classifiche.slice(0, 10);
  const remaining = classifiche.slice(10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Top 10 Candidati
          <Badge variant="secondary" className="ml-auto">
            <Users className="h-3 w-3 mr-1" />
            {classifiche.length} totali
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {classifiche.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nessun voto ancora registrato per questo ministero.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Top 10 sempre visibili */}
            {topTen.map((candidato, index) => (
              <div
                key={candidato.nome}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                  selectedVoti.includes(candidato.nome)
                    ? 'bg-primary/10 border-primary/20 ring-2 ring-primary/20'
                    : 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200 hover:from-yellow-100 hover:to-yellow-200'
                }`}
                onClick={() => onToggleSelezione(candidato.nome)}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                    index < 3 
                      ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white'
                      : 'bg-gradient-to-br from-blue-400 to-blue-600 text-white'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="font-medium">{candidato.nome}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{candidato.voti} voti</Badge>
                  {selectedVoti.includes(candidato.nome) && (
                    <Badge variant="default" className="bg-primary">
                      Selezionato
                    </Badge>
                  )}
                </div>
              </div>
            ))}

            {/* Candidati rimanenti (se ci sono) */}
            {remaining.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  Altri {remaining.length} candidati:
                </p>
                <div className="space-y-1">
                  {remaining.map((candidato, index) => (
                    <div
                      key={candidato.nome}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                        selectedVoti.includes(candidato.nome)
                          ? 'bg-primary/10 border-primary/20'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                      onClick={() => onToggleSelezione(candidato.nome)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600 w-6">
                          {index + 11}.
                        </span>
                        <span className="text-sm">{candidato.nome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {candidato.voti} voti
                        </Badge>
                        {selectedVoti.includes(candidato.nome) && (
                          <Badge variant="default" className="bg-primary text-xs">
                            Selezionato
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
