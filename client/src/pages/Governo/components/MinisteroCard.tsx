import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Vote, Trophy, X } from "lucide-react";
import { MinisteroCardProps } from "../types";

export const MinisteroCard: React.FC<MinisteroCardProps> = ({
  ministero,
  selectedVoti,
  expandedCategories,
  data,
  onVotoChange,
  onVotoRemove,
  onToggleExpansion
}) => {
  const IconComponent = ministero.icon;
  const isExpanded = expandedCategories[ministero.categoria];
  const hasVoti = data?.classifiche[ministero.categoria]?.length > 0;
  const candidati = data?.classifiche[ministero.categoria] || [];
  const topThree = candidati.slice(0, 3);
  const remaining = candidati.slice(3);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <div className={`p-3 rounded-lg ${ministero.color}`}>
            <IconComponent className="h-6 w-6" />
          </div>
          {data?.mieiVoti[ministero.categoria] && (
            <Badge variant="default">
              <Vote className="h-3 w-3 mr-1" />Votato
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg">{ministero.title}</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-grow flex flex-col justify-between space-y-4">
        <div>
          <div className="flex space-x-2">
            <Input 
              placeholder="Nome del candidato..." 
              value={selectedVoti[ministero.categoria] || ""} 
              onChange={e => onVotoChange(ministero.categoria, e.target.value)} 
              disabled={data?.blocco.isBlocked} 
            />
            {selectedVoti[ministero.categoria] && (
              <Button 
                size="icon" 
                variant="destructive" 
                onClick={() => onVotoRemove(ministero.categoria)} 
                disabled={data?.blocco.isBlocked}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center">
            <Trophy className="h-4 w-4 mr-1 text-yellow-500" />Classifica Candidati
          </h4>
          
          {hasVoti ? (
            <div className="space-y-2">
              {/* Primi 3 candidati sempre visibili */}
              <div className="space-y-1">
                {topThree.map((candidato, index) => (
                  <div 
                    key={candidato.nome} 
                    className="flex items-center justify-between p-2 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200 hover:from-yellow-100 hover:to-yellow-200 transition-all duration-300"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-full text-xs font-bold">
                        {index + 1}
                      </div>
                      <span className="font-medium text-sm">{candidato.nome}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{candidato.voti} voti</Badge>
                  </div>
                ))}
              </div>
              
              {/* Candidati rimanenti (espandibili) */}
              {remaining.length > 0 && (
                <div className="space-y-2">
                  {/* Pulsante per espandere/comprimere */}
                  <Button 
                    onClick={() => onToggleExpansion(ministero.categoria)} 
                    variant="outline" 
                    size="sm"
                    className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all duration-300 text-xs"
                  >
                    <Trophy className="h-3 w-3 mr-1 text-blue-600" />
                    {isExpanded 
                      ? `Nascondi (${remaining.length} candidati)` 
                      : `Mostra Altro (${remaining.length} candidati rimanenti)`
                    }
                  </Button>
                  
                  {/* Candidati rimanenti (animati) */}
                  {isExpanded && (
                    <div className="space-y-1 transition-all duration-500 ease-out">
                      {remaining.map((candidato, index) => (
                        <div 
                          key={candidato.nome} 
                          className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300"
                        >
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-br from-blue-400 to-indigo-600 text-white rounded-full text-xs font-bold">
                              {index + 4}
                            </div>
                            <span className="font-medium text-sm">{candidato.nome}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">{candidato.voti} voti</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nessun voto ancora registrato.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
