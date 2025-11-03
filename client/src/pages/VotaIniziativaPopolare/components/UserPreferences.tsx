import React from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, X, Info, CheckCircle2 } from "lucide-react";
import { Iniziativa } from "../types";

interface UserPreferencesProps {
  selectedVoti: string[];
  iniziative: Iniziativa[];
  onRemoveVoto: (id: string) => void;
  currentVotes: number;
  limit: number;
  remainingVotes: number;
  hasReachedLimit: boolean;
}

export const UserPreferences: React.FC<UserPreferencesProps> = ({
  selectedVoti,
  iniziative,
  onRemoveVoto,
  currentVotes,
  limit,
  remainingVotes,
  hasReachedLimit
}) => {
  return (
    <Card className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-xl border-2 border-blue-100/50 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <ThumbsUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Il tuo voto</h2>
              <CardDescription className="text-blue-100 mt-1">
                Puoi votare solo {limit} iniziativa popolare tra quelle disponibili
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              variant={hasReachedLimit ? "destructive" : "secondary"} 
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-semibold ${
                hasReachedLimit 
                  ? "bg-red-500 hover:bg-red-600 text-white" 
                  : "bg-white/20 backdrop-blur-sm text-white border-white/30"
              }`}
            >
              <Info className="h-4 w-4" />
              <span>{currentVotes}/{limit}</span>
            </Badge>
          </div>
        </div>
        {hasReachedLimit && (
          <div className="mt-3 p-3 bg-yellow-500/20 backdrop-blur-sm rounded-lg border border-yellow-300/30">
            <p className="text-yellow-100 font-medium flex items-center">
              <Info className="h-4 w-4 mr-2" />
              Hai già votato. Rimuovi il voto esistente per votarne una diversa.
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        {selectedVoti.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>Le tue iniziative selezionate:</span>
            </div>
            <div className="grid gap-3">
              {selectedVoti.map((id) => {
                const iniziativa = iniziative.find(i => i.id === id);
                return iniziativa ? (
                  <div
                    key={id}
                    className="group relative p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="flex-shrink-0 p-2 bg-green-500 rounded-full">
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 text-lg group-hover:text-green-700 transition-colors">
                            {iniziativa.nome}
                          </h3>
                          {iniziativa.descrizione && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {iniziativa.descrizione}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onRemoveVoto(id)}
                        className="ml-4 flex-shrink-0 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-300 transform hover:scale-110 shadow-md hover:shadow-xl group/btn"
                        title="Rimuovi voto"
                      >
                        <X className="h-5 w-5 group-hover/btn:rotate-90 transition-transform duration-300" />
                      </button>
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <ThumbsUp className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">Nessuna iniziativa selezionata</p>
            <p className="text-sm text-gray-500 mt-1">Scegli un'iniziativa dalla classifica per votare</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
