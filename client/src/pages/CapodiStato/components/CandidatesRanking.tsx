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
      <Card className="border-0 bg-transparent shadow-none lg:border lg:bg-white lg:shadow-sm lg:h-full lg:overflow-hidden">
        <CardHeader className="px-1 pb-1 pt-2 lg:p-6 lg:py-3">
          <CardTitle className="flex items-center gap-2 text-base lg:text-2xl lg:text-lg">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Classifica candidati</span>
          </CardTitle>
          <CardDescription className="hidden lg:block">
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
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-0 bg-transparent shadow-none lg:border lg:bg-white lg:shadow-sm">
      <CardHeader className="shrink-0 px-1 pb-1 pt-2 lg:p-6 lg:py-3">
        <CardTitle className="flex items-center gap-2 text-base lg:text-2xl lg:text-lg">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Classifica candidati</span>
        </CardTitle>
        <CardDescription className="hidden lg:block lg:text-xs">
          I candidati che hanno ricevuto più voti ({classifica.length} totali)
        </CardDescription>
      </CardHeader>
      <CardContent
        className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-0 pb-4 pt-0 lg:px-6 lg:pb-6"
        role="region"
        aria-label="Lista candidati Capo di Stato"
        tabIndex={0}
      >
        <div className="space-y-0 lg:space-y-1.5">
          {classifica.map((item, index) => (
            <div 
              key={item.nome} 
              className={`group flex min-h-[58px] min-w-0 flex-row items-center justify-between gap-2 border-b border-gray-200 bg-white px-2 py-1.5 lg:min-h-0 lg:flex-col lg:gap-2 lg:rounded-xl lg:border lg:p-4 lg:flex-row lg:gap-2 lg:p-2 ${
                index < 3 
                  ? 'lg:bg-gradient-to-r lg:from-yellow-50 lg:to-yellow-100 lg:border-yellow-200 lg:hover:from-yellow-100 lg:hover:to-yellow-200' 
                  : 'lg:bg-gradient-to-r lg:from-blue-50 lg:to-indigo-50 lg:border-blue-200 lg:hover:from-blue-100 lg:hover:to-indigo-100'
              } transition-colors lg:hover:shadow-lg lg:hover:shadow-sm`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 lg:w-full lg:gap-3 lg:w-auto lg:gap-2">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center lg:h-10 lg:w-10 lg:h-7 lg:w-7 ${
                  index < 3 
                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 group-hover:from-yellow-500 group-hover:to-yellow-700' 
                    : 'bg-gradient-to-br from-blue-400 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-700'
                } rounded-full text-xs font-bold text-white shadow-sm lg:text-lg lg:shadow-md lg:text-xs`}>
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className={`break-words text-sm font-semibold leading-snug text-gray-800 lg:text-lg lg:font-bold lg:truncate lg:whitespace-nowrap lg:text-sm transition-colors ${
                    index < 3 ? 'group-hover:text-yellow-800' : 'group-hover:text-indigo-800'
                  }`}>
                    {item.nome}
                  </h4>
                  <p className="flex items-center text-xs text-gray-600 lg:text-sm lg:text-xs">
                    <Trophy className={`mr-1 hidden h-4 w-4 lg:inline-block lg:mr-1 lg:h-3 lg:w-3 ${index < 3 ? 'text-yellow-500' : 'text-blue-500'}`} />
                    {item.voti} voti
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleSelezione(item.nome)}
                disabled={isPending || isBlocked || (hasReachedLimit && !selectedVoti.includes(item.nome))}
                className={`h-11 w-auto shrink-0 self-auto px-2.5 text-xs transition-colors lg:h-9 lg:self-end lg:px-3 lg:text-sm lg:ml-2 lg:h-7 lg:self-auto lg:px-2 lg:text-xs ${
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
                    <span className="lg:hidden">Scelto</span><span className="hidden lg:inline">Selezionato</span>
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
