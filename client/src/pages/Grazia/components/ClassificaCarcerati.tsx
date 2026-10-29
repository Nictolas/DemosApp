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
      <Card className="border-0 bg-transparent shadow-none sm:border sm:bg-white sm:shadow-sm">
        <CardHeader className="px-1 pb-2 pt-2 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Classifica carcerati</span>
          </CardTitle>
          <CardDescription className="hidden text-xs sm:block sm:text-sm">
            I carcerati con più richieste di grazia (0 totali)
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-3 pt-2 sm:px-6 sm:pb-6">
          <div className="py-6 text-center text-gray-500 sm:py-12">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-300 sm:mb-6 sm:h-20 sm:w-20">
              <Trophy className="h-6 w-6 text-gray-400 sm:h-10 sm:w-10" />
            </div>
            <p className="text-sm font-medium text-gray-600 sm:text-lg">Nessuna classifica disponibile al momento</p>
            <p className="text-sm text-gray-500 mt-2">Riprova più tardi</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topThree = getTopThreeClassifica(classifica);
  const remaining = getRemainingClassifica(classifica);

  return (
    <Card className="border-0 bg-transparent shadow-none sm:border sm:bg-white sm:shadow-sm">
      <CardHeader className="px-1 pb-2 pt-2 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Classifica carcerati</span>
        </CardTitle>
        <CardDescription className="hidden text-xs sm:block sm:text-sm">
          I carcerati con più richieste di grazia ({classifica.length} totali)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-2 pt-0 sm:px-6 sm:pb-6 sm:pt-0">
        <div className="space-y-0 sm:space-y-4">
          {/* Primi 3 carcerati sempre visibili */}
          <div className="space-y-0 sm:space-y-3">
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
            <div className="space-y-0 sm:space-y-3">
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
