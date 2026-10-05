import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Trophy } from "lucide-react";
import { Referendum, Classifica } from "../types";

interface ReferendumRankingProps {
  classifica: Classifica[];
  referendum: Referendum[];
  selectedVoti: string[];
  onToggleSelezioneClassifica: (nome: string) => void;
  onViewReferendum?: (referendum: Referendum) => void;
  isBlocked: boolean;
  isPending: boolean;
  hasReachedLimit: boolean;
}

export const ReferendumRanking: React.FC<ReferendumRankingProps> = ({
  classifica,
  referendum,
  selectedVoti,
  onToggleSelezioneClassifica,
  onViewReferendum,
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
            <span>Classifica Referendum Abrogativi</span>
          </CardTitle>
          <CardDescription>
            I referendum che hanno ricevuto più voti (0 totali)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <div className="w-20 h-20 bg-linear-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Trophy className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-600">
              Nessuna classifica referendum disponibile al momento
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
          <span>Classifica Referendum Abrogativi</span>
        </CardTitle>
        <CardDescription>
          I referendum che hanno ricevuto più voti ({classifica.length} totali)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Tutti i referendum sempre visibili */}
          <div className="space-y-3">
            {classifica.map((item, index) => (
              <div 
                key={item.nome} 
                className={`group flex items-center justify-between p-4 ${
                  index < 3 
                    ? 'bg-linear-to-r from-yellow-50 to-yellow-100 border-yellow-200 hover:from-yellow-100 hover:to-yellow-200'
                    : 'bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100'
                } rounded-xl border transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg ${
                  onViewReferendum ? 'cursor-pointer' : ''
                }`}
                onClick={() => {
                  if (onViewReferendum) {
                    const referendumItem = referendum.find(r => r.nome === item.nome);
                    if (referendumItem) onViewReferendum(referendumItem);
                  }
                }}
              >
                <div className="flex items-center space-x-4">
                  <div className={`flex items-center justify-center w-10 h-10 ${
                    index < 3 
                      ? 'bg-linear-to-br from-yellow-400 to-yellow-600 group-hover:from-yellow-500 group-hover:to-yellow-700'
                      : 'bg-linear-to-br from-blue-400 to-indigo-600 group-hover:from-blue-500 group-hover:to-indigo-700'
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
                      {item.nome}
                    </h4>
                    {(() => {
                      const referendumItem = referendum.find(r => r.nome === item.nome);
                      return referendumItem?.descrizione ? (
                        <p className="text-gray-600 mb-2 mt-1 line-clamp-2">
                          {referendumItem.descrizione}
                        </p>
                      ) : null;
                    })()}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        Firme raccolte: <strong>
                          {(() => {
                            const referendumItem = referendum.find(r => r.nome === item.nome);
                            return (referendumItem?.firme || 0).toLocaleString('it-IT');
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
                    referendum.find(r => r.nome === item.nome) && selectedVoti.includes(referendum.find(r => r.nome === item.nome)!.id)
                      ? "bg-blue-100 border-blue-500 text-blue-700 hover:bg-blue-200 shadow-md"
                      : index < 3 
                        ? "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700"
                        : "hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
                  }`}
                >
                  {referendum.find(r => r.nome === item.nome) && selectedVoti.includes(referendum.find(r => r.nome === item.nome)!.id) ? (
                    <>
                      <ThumbsUp className="h-4 w-4 mr-2" />
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
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
