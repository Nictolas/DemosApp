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
      <Card className="bg-white lg:h-full lg:overflow-hidden">
        <CardHeader className="lg:py-3">
          <CardTitle className="flex items-center space-x-2 lg:text-lg">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Classifica Candidati</span>
          </CardTitle>
          <CardDescription>
            I candidati che hanno ricevuto più voti (0 totali)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <div className="w-20 h-20 bg-linear-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
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
    <Card className="bg-white lg:h-full lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col">
      <CardHeader className="lg:py-3 shrink-0">
        <CardTitle className="flex items-center space-x-2 lg:text-lg">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Classifica Candidati</span>
        </CardTitle>
        <CardDescription className="lg:text-xs">
          I candidati che hanno ricevuto più voti ({classifica.length} totali)
        </CardDescription>
      </CardHeader>
      <CardContent className="lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:pt-0">
        <div className="space-y-3 lg:space-y-1.5 lg:h-full lg:overflow-hidden">
          {classifica.map((item, index) => (
            <div 
              key={item.nome} 
              className={`group flex items-center justify-between p-4 lg:p-2 ${
                index < 3 
                  ? 'bg-linear-to-r from-yellow-50 to-yellow-100 border-yellow-200 hover:from-yellow-100 hover:to-yellow-200'
                  : 'bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100'
              } rounded-xl border transition-all duration-300 lg:hover:scale-100 hover:scale-[1.02] hover:shadow-lg lg:hover:shadow-xs`}
            >
              <div className="flex items-center space-x-4 lg:space-x-2 min-w-0">
                <div className={`flex items-center justify-center w-10 h-10 lg:w-7 lg:h-7 shrink-0 ${
                  index < 3 
                    ? 'bg-linear-to-br from-yellow-400 to-yellow-600 group-hover:from-yellow-500 group-hover:to-yellow-700'
                    : 'bg-linear-to-br from-blue-400 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-700'
                } text-white rounded-full font-bold text-lg lg:text-xs shadow-md transition-all duration-300`}>
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <h4 className={`font-bold text-gray-800 text-lg lg:text-sm truncate transition-colors duration-300 ${
                    index < 3 ? 'group-hover:text-yellow-800' : 'group-hover:text-indigo-800'
                  }`}>
                    {item.nome}
                  </h4>
                  <p className="text-sm lg:text-xs text-gray-600 flex items-center">
                    <Trophy className={`h-4 w-4 lg:h-3 lg:w-3 mr-2 lg:mr-1 ${index < 3 ? 'text-yellow-500' : 'text-blue-500'}`} />
                    {item.voti} voti
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleSelezione(item.nome)}
                disabled={isPending || isBlocked || (hasReachedLimit && !selectedVoti.includes(item.nome))}
                className={`shrink-0 lg:h-7 lg:px-2 lg:text-xs transition-all duration-300 ${
                  selectedVoti.includes(item.nome) 
                    ? "bg-green-100 border-green-500 text-green-700 hover:bg-green-200 shadow-md" 
                    : selectedVoti.length >= 3
                      ? "opacity-50 cursor-not-allowed"
                      : index < 3 
                        ? "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700"
                        : "hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
                }`}
              >
                {selectedVoti.includes(item.nome) ? (
                  <>
                    <ThumbsUp className="h-4 w-4 lg:h-3 lg:w-3 mr-2 lg:mr-1" />
                    Selezionato
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 lg:h-3 lg:w-3 mr-2 lg:mr-1" />
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
