import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Trophy, Plus } from "lucide-react";
import { Iniziativa, Classifica } from "../types";

interface IniziativeRankingProps {
  classifica: Classifica[];
  iniziative: Iniziativa[];
  selectedVoti: string[];
  onToggleSelezioneClassifica: (nome: string) => void;
  onViewIniziativa?: (iniziativa: Iniziativa) => void;
  isBlocked: boolean;
  isPending: boolean;
  hasReachedLimit: boolean;
}

export const IniziativeRanking: React.FC<IniziativeRankingProps> = ({
  classifica,
  iniziative,
  selectedVoti,
  onToggleSelezioneClassifica,
  onViewIniziativa,
  isBlocked,
  isPending,
  hasReachedLimit
}) => {

  if (!classifica || classifica.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Classifica Iniziative Popolari</span>
          </CardTitle>
          <CardDescription>
            Le iniziative che hanno ricevuto più voti (0 totali)
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
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Classifica Iniziative Popolari</span>
        </CardTitle>
        <CardDescription>
          Le iniziative che hanno ricevuto più voti ({classifica.length} totali)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Tutte le iniziative sempre visibili */}
          <div className="space-y-3">
            {classifica.map((item, index) => (
              <div 
                key={item.nome} 
                className={`group flex items-center justify-between p-4 ${
                  index < 3 
                    ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200 hover:from-yellow-100 hover:to-yellow-200' 
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100'
                } rounded-xl border transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg ${
                  onViewIniziativa ? 'cursor-pointer' : ''
                }`}
                onClick={() => {
                  if (onViewIniziativa) {
                    const iniziativa = iniziative.find(i => i.nome === item.nome);
                    if (iniziativa) onViewIniziativa(iniziativa);
                  }
                }}
              >
                <div className="flex items-center space-x-4">
                  <div className={`flex items-center justify-center w-10 h-10 ${
                    index < 3 
                      ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 group-hover:from-yellow-500 group-hover:to-yellow-700' 
                      : 'bg-gradient-to-br from-blue-400 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-700'
                  } text-white rounded-full font-bold text-lg shadow-md transition-all duration-300`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-bold text-gray-800 text-lg transition-colors duration-300 flex items-center gap-2 ${
                      index < 3 ? 'group-hover:text-yellow-800' : 'group-hover:text-indigo-800'
                    }`}>
                      {/* Mostra emoji se disponibile - a sinistra del nome */}
                      {item.emoji && (
                        <span className="text-2xl" role="img" aria-label="emoji">
                          {item.emoji}
                        </span>
                      )}
                      {item.sitoWeb ? (
                        <a 
                          href={item.sitoWeb} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-yellow-600 hover:underline transition-colors duration-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.nome}
                        </a>
                      ) : (
                        item.nome
                      )}
                    </h4>
                    {(() => {
                      const iniziativaItem = iniziative.find(i => i.nome === item.nome);
                      return iniziativaItem?.descrizione ? (
                        <p className="text-gray-600 mb-2 mt-1 line-clamp-2">
                          {iniziativaItem.descrizione}
                        </p>
                      ) : null;
                    })()}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        Firme raccolte: <strong>
                          {(() => {
                            const iniziativaItem = iniziative.find(i => i.nome === item.nome);
                            return (iniziativaItem?.firme || 0).toLocaleString('it-IT');
                          })()}
                        </strong>
                      </span>
                      <p className="text-sm text-gray-600 flex items-center">
                        <Trophy className={`h-4 w-4 mr-2 ${index < 3 ? 'text-yellow-500' : 'text-blue-500'}`} />
                        {item.voti} voti
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelezioneClassifica(item.nome);
                  }}
                  disabled={isPending || isBlocked}
                  className={`transition-all duration-300 ${
                    iniziative.find(i => i.nome === item.nome) && selectedVoti.includes(iniziative.find(i => i.nome === item.nome)!.id)
                      ? "bg-blue-100 border-blue-500 text-blue-700 hover:bg-blue-200 shadow-md"
                      : index < 3 
                        ? "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700"
                        : "hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
                  }`}
                >
                  {iniziative.find(i => i.nome === item.nome) && selectedVoti.includes(iniziative.find(i => i.nome === item.nome)!.id) ? (
                    <>
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Selezionato
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Seleziona
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
