import React, { useState } from "react";
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
  const [showAllClassifica, setShowAllClassifica] = useState(false);

  const handleShowClassifica = () => setShowAllClassifica(!showAllClassifica);

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
            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
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
          {/* Primi 3 referendum sempre visibili */}
          <div className="space-y-3">
            {classifica.slice(0, 3).map((item, index) => (
              <div 
                key={item.nome} 
                className={`group flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200 hover:from-yellow-100 hover:to-yellow-200 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg ${
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
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 text-white rounded-full font-bold text-lg shadow-md group-hover:from-yellow-500 group-hover:to-yellow-700 transition-all duration-300">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg group-hover:text-yellow-800 transition-colors duration-300">
                      {item.nome}
                    </h4>
                    <p className="text-sm text-gray-600 flex items-center">
                      <Trophy className="h-4 w-4 mr-2 text-yellow-500" />
                      {item.voti} voti
                    </p>
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
                      : "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700"
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
          
          {/* Referendum rimanenti (espandibili) */}
          {classifica.length > 3 && (
            <div className="space-y-3">
              {/* Pulsante per espandere/comprimere */}
              <div className="text-center">
                <Button 
                  onClick={handleShowClassifica} 
                  variant="outline" 
                  size="lg"
                  className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all duration-300 transform hover:scale-[1.02] shadow-md"
                >
                  <Trophy className="h-5 w-5 mr-2 text-blue-600" />
                  {showAllClassifica 
                    ? `Nascondi (${classifica.length - 3} referendum abrogativi)` 
                    : `Mostra Altro (${classifica.length - 3} referendum abrogativi rimanenti)`
                  }
                </Button>
              </div>
              
              {/* Referendum rimanenti (animati) */}
              {showAllClassifica && (
                <div className="space-y-3 transition-all duration-500 ease-out">
                  {classifica.slice(3).map((item, index) => (
                    <div 
                      key={item.nome} 
                      className={`group flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg ${
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
                        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 text-white rounded-full font-bold text-lg shadow-md group-hover:from-blue-500 group-hover:to-indigo-700 transition-all duration-300">
                          {index + 4}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 text-lg group-hover:text-indigo-800 transition-colors duration-300">
                            {item.nome}
                          </h4>
                          <p className="text-sm text-gray-600 flex items-center">
                            <Trophy className="h-4 w-4 mr-2 text-blue-500" />
                            {item.voti} voti
                          </p>
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
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
