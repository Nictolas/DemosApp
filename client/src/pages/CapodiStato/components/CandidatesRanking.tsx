import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ThumbsUp, Plus } from "lucide-react";
import { Classifica } from "../types";

interface CandidatesRankingProps {
  classifica: Classifica[];
  selectedVoti: string[];
  isBlocked: boolean;
  isPending: boolean;
  onToggleSelezione: (nome: string) => void;
  hasReachedLimit: boolean;
}

export const CandidatesRanking: React.FC<CandidatesRankingProps> = ({
  classifica,
  selectedVoti,
  isBlocked,
  isPending,
  onToggleSelezione,
  hasReachedLimit
}) => {

  if (!classifica || classifica.length === 0) {
    return (
      <Card className="border-0 bg-transparent shadow-none sm:border sm:bg-white sm:shadow-sm lg:h-full lg:overflow-hidden">
        <CardHeader className="px-1 pb-1 pt-2 sm:p-6 lg:py-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-2xl lg:text-lg">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Classifica candidati</span>
          </CardTitle>
          <CardDescription className="hidden sm:block">
            I candidati che hanno ricevuto più voti (0 totali)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Trophy className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-600">
              Nessuna classifica disponibile al momento
            </p>
            <p className="text-sm text-gray-500 mt-2">Riprova più tardi</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-transparent shadow-none sm:border sm:bg-white sm:shadow-sm lg:h-full lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col">
      <CardHeader className="shrink-0 px-1 pb-1 pt-2 sm:p-6 lg:py-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-2xl lg:text-lg">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Classifica candidati</span>
        </CardTitle>
        <CardDescription className="hidden sm:block lg:text-xs">
          I candidati che hanno ricevuto più voti ({classifica.length} totali)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-2 pt-0 sm:px-6 sm:pb-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:pt-0">
        <div className="space-y-0 sm:space-y-3 lg:space-y-1.5 lg:h-full lg:overflow-hidden">
          {classifica.map((item, index) => (
            <div 
              key={item.nome} 
              className={`group flex min-h-[58px] min-w-0 flex-row items-center justify-between gap-2 border-b border-gray-200 bg-white px-2 py-1.5 sm:min-h-0 sm:flex-col sm:gap-2 sm:rounded-xl sm:border sm:p-4 lg:flex-row lg:gap-2 lg:p-2 ${
                index < 3 
                  ? 'sm:bg-gradient-to-r sm:from-yellow-50 sm:to-yellow-100 sm:border-yellow-200 sm:hover:from-yellow-100 sm:hover:to-yellow-200' 
                  : 'sm:bg-gradient-to-r sm:from-blue-50 sm:to-indigo-50 sm:border-blue-200 sm:hover:from-blue-100 sm:hover:to-indigo-100'
              } transition-colors sm:hover:shadow-lg lg:hover:shadow-sm`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:w-full sm:gap-3 lg:w-auto lg:gap-2">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center sm:h-10 sm:w-10 lg:h-7 lg:w-7 ${
                  index < 3 
                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 group-hover:from-yellow-500 group-hover:to-yellow-700' 
                    : 'bg-gradient-to-br from-blue-400 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-700'
                } rounded-full text-xs font-bold text-white shadow-sm sm:text-lg sm:shadow-md lg:text-xs`}>
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className={`break-words text-sm font-semibold leading-snug text-gray-800 sm:text-lg sm:font-bold lg:truncate lg:whitespace-nowrap lg:text-sm transition-colors ${
                    index < 3 ? 'group-hover:text-yellow-800' : 'group-hover:text-indigo-800'
                  }`}>
                    {item.nome}
                  </h4>
                  <p className="flex items-center text-xs text-gray-600 sm:text-sm lg:text-xs">
                    <Trophy className={`mr-1 hidden h-4 w-4 sm:inline-block lg:mr-1 lg:h-3 lg:w-3 ${index < 3 ? 'text-yellow-500' : 'text-blue-500'}`} />
                    {item.voti} voti
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleSelezione(item.nome)}
                disabled={isPending || isBlocked || (hasReachedLimit && !selectedVoti.includes(item.nome))}
                className={`h-11 w-auto shrink-0 self-auto px-2.5 text-xs transition-colors sm:h-9 sm:self-end sm:px-3 sm:text-sm lg:ml-2 lg:h-7 lg:self-auto lg:px-2 lg:text-xs ${
                  selectedVoti.includes(item.nome) 
                    ? "bg-green-100 border-green-500 text-green-700 hover:bg-green-200 shadow-md" 
                    : index < 3 
                        ? "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700"
                        : "hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
                }`}
              >
                {selectedVoti.includes(item.nome) ? (
                  <>
                    <ThumbsUp className="mr-1 h-4 w-4 lg:mr-1 lg:h-3 lg:w-3" />
                    <span className="sm:hidden">Scelto</span><span className="hidden sm:inline">Selezionato</span>
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4 lg:mr-1 lg:h-3 lg:w-3" />
                    Seleziona
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
