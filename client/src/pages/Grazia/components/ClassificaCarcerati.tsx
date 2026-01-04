import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { Classifica } from "../types";
import { CarceratoItem } from "./CarceratoItem";
import { 
  getTopThreeClassifica, 
  getRemainingClassifica, 
  isTopThree 
} from "../utils/graziaUtils";

interface ClassificaCarceratiProps {
  classifica: Classifica[];
  selectedVoti: string[];
  isBlocked: boolean;
  isPending: boolean;
  onToggleSelezione: (nome: string) => void;
  hasReachedLimit: boolean;
}

export const ClassificaCarcerati: React.FC<ClassificaCarceratiProps> = ({
  classifica,
  selectedVoti,
  isBlocked,
  isPending,
  onToggleSelezione,
  hasReachedLimit
}) => {
  if (!classifica || classifica.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Classifica Carcerati</span>
          </CardTitle>
          <CardDescription>
            I carcerati con più richieste di grazia (0 totali)
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
          <span>Classifica Carcerati</span>
        </CardTitle>
        <CardDescription>
          I carcerati con più richieste di grazia ({classifica.length} totali)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Primi 3 carcerati sempre visibili */}
          <div className="space-y-3">
            {topThree.map((item, index) => (
              <CarceratoItem
                key={item.nome}
                item={item}
                index={index}
                isSelected={selectedVoti.includes(item.nome)}
                isTopThree={isTopThree(index)}
                onToggleSelezione={onToggleSelezione}
                disabled={isPending || isBlocked || (hasReachedLimit && !selectedVoti.includes(item.nome))}
              />
            ))}
          </div>
          
          {/* Carcerati rimanenti sempre visibili */}
          {remaining.length > 0 && (
            <div className="space-y-3">
              {remaining.map((item, index) => (
                <CarceratoItem
                  key={item.nome}
                  item={item}
                  index={index + 3}
                  isSelected={selectedVoti.includes(item.nome)}
                  isTopThree={isTopThree(index + 3)}
                  onToggleSelezione={onToggleSelezione}
                  disabled={isPending || isBlocked || (hasReachedLimit && !selectedVoti.includes(item.nome))}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
