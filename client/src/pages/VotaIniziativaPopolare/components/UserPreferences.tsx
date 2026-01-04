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
  // Debug: verifica corrispondenza tra selectedVoti e iniziative
  React.useEffect(() => {
    if (selectedVoti.length > 0 && iniziative.length > 0) {
      const votiNonTrovati = selectedVoti.filter(votoId => {
        return !iniziative.some(i => String(i.id) === String(votoId));
      });
      
      if (votiNonTrovati.length > 0) {
        console.warn('⚠️ DEBUG UserPreferences: Voti non trovati nelle iniziative:', votiNonTrovati);
        console.warn('⚠️ DEBUG UserPreferences: selectedVoti:', selectedVoti);
        console.warn('⚠️ DEBUG UserPreferences: iniziative IDs:', iniziative.map(i => ({ id: i.id, nome: i.nome })));
        
        // Prova a trovare per nome o ID parziale
        votiNonTrovati.forEach(votoId => {
          const votoIdStr = String(votoId);
          const matchPerNome = iniziative.find(i => {
            const nomeNormalized = String(i.nome || '').toLowerCase().trim();
            const votoIdLower = votoIdStr.toLowerCase().trim();
            return nomeNormalized === votoIdLower || nomeNormalized.includes(votoIdLower) || votoIdLower.includes(nomeNormalized);
          });
          
          if (matchPerNome) {
            console.log(`✅ DEBUG UserPreferences: Trovata corrispondenza per nome: "${votoIdStr}" -> ID: ${matchPerNome.id} (nome: "${matchPerNome.nome}")`);
          } else {
            console.error(`❌ DEBUG UserPreferences: Nessuna corrispondenza trovata per votoId "${votoIdStr}"`);
          }
        });
      } else {
        console.log('✅ DEBUG UserPreferences: Tutti i voti hanno corrispondenza nelle iniziative');
      }
    }
  }, [selectedVoti, iniziative]);

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
                // Cerca prima per ID esatto
                let iniziativa = iniziative.find(i => String(i.id) === String(id));
                
                // Se non trova per ID, prova a cercare per nome (caso in cui iniziativa_id è un nome)
                if (!iniziativa) {
                  const idStr = String(id);
                  iniziativa = iniziative.find(i => {
                    const nomeNormalized = String(i.nome || '').toLowerCase().trim();
                    const idLower = idStr.toLowerCase().trim();
                    return nomeNormalized === idLower || nomeNormalized.includes(idLower) || idLower.includes(nomeNormalized);
                  });
                  
                  if (iniziativa) {
                    console.log(`✅ DEBUG UserPreferences: Trovata iniziativa per nome: "${idStr}" -> ID: ${iniziativa.id} (nome: "${iniziativa.nome}")`);
                  }
                }
                
                // Se l'iniziativa non viene trovata, mostra comunque l'ID (può succedere durante il caricamento)
                if (!iniziativa) {
                  return (
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
                              Caricamento... (ID: {String(id).substring(0, 20)}...)
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              L'iniziativa potrebbe non essere più disponibile per il voto
                            </p>
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
                  );
                }
                return (
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
                          <h3 className="font-bold text-gray-900 text-lg group-hover:text-green-700 transition-colors flex items-center gap-2">
                            {iniziativa.emoji && (
                              <span className="text-2xl" role="img" aria-label="emoji">
                                {iniziativa.emoji}
                              </span>
                            )}
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
                );
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
