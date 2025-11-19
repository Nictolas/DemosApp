import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { Classifica } from "../types";
import { LeggeItem } from "./LeggeItem";
import {
  getTopThreeClassifica,
  getRemainingClassifica,
  isTopThree
} from "../utils/amnistiaUtils";

interface ClassificaLeggiProps {
  classifica: Classifica[];
  showAllClassifica: boolean;
  isPending: boolean;
  onVote: (legge: string) => void;
  onShowClassifica: () => void;
  hasReachedLimit: boolean;
  mieiVoti?: string[];
}

export const ClassificaLeggi: React.FC<ClassificaLeggiProps> = ({
  classifica,
  showAllClassifica,
  isPending,
  onVote,
  onShowClassifica,
  hasReachedLimit,
  mieiVoti = []
}) => {
  if (!classifica || classifica.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Classifica Leggi</span>
          </CardTitle>
          <CardDescription>
            Le leggi che hanno ricevuto più richieste di amnistia (0 totali)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Trophy className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-600">Nessuna classifica disponibile al momento</p>
            <p className="text-sm text-gray-500 mt-2">Riprova più tardi</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topThree = getTopThreeClassifica(classifica);
  const remaining = getRemainingClassifica(classifica);

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Classifica Leggi</span>
        </CardTitle>
        <CardDescription>
          Le leggi che hanno ricevuto più richieste di amnistia ({classifica.length} totali)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Primi 3 leggi sempre visibili */}
          <div className="space-y-3">
            {topThree.map((item, index) => (
              <LeggeItem
                key={item.legge}
                item={item}
                index={index}
                isTopThree={isTopThree(index)}
                onVote={onVote}
                isPending={isPending}
                hasReachedLimit={hasReachedLimit}
                isSelected={mieiVoti.includes(item.legge)}
              />
            ))}
          </div>

          {/* Leggi rimanenti (espandibili) */}
          {remaining.length > 0 && (
            <div className="space-y-3">
              {/* Pulsante per espandere/comprimere */}
              <div className="text-center">
                <Button 
                  onClick={onShowClassifica} 
                  variant="outline" 
                  size="lg"
                  className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all duration-300 transform hover:scale-[1.02] shadow-md"
                >
                  <Trophy className="h-5 w-5 mr-2 text-blue-600" />
                  {showAllClassifica 
                    ? `Nascondi (${remaining.length} leggi)` 
                    : `Mostra Altro (${remaining.length} leggi rimanenti)`
                  }
                </Button>
              </div>
              
              {/* Leggi rimanenti (animati) */}
              {showAllClassifica && (
                <div className="space-y-3 transition-all duration-500 ease-out">
                  {remaining.map((item, index) => (
                    <LeggeItem
                      key={item.legge}
                      item={item}
                      index={index + 3}
                      isTopThree={isTopThree(index + 3)}
                      onVote={onVote}
                      isPending={isPending}
                      hasReachedLimit={hasReachedLimit}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
