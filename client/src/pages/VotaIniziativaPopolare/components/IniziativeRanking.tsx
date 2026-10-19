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


/** Solo il testo della scheda viene abbreviato: il titolo ufficiale non cambia. */
function getTitoloBreve(nome: string): string {
  const s = nome.toLocaleLowerCase("it-IT");
  if (s.includes("accisa generale sui prodotti da fumo") && s.includes("servizio sanitario nazionale"))
    return "Accise su tabacco e nicotina per finanziare il SSN";
  if (s.includes("divieto progressivo delle gabbie") && s.includes("allevamenti"))
    return "Stop alle gabbie negli allevamenti";
  if (s.includes("decreto del presidente della repubblica 26 ottobre 1972") && s.includes("igiene femminile"))
    return "IVA ridotta sui prodotti per l'igiene femminile e la prima infanzia";
  return nome;
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
      <CardHeader className="px-3 pt-4 pb-3 sm:px-6">
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Classifica Iniziative Popolari</span>
        </CardTitle>
        <CardDescription>
          Le iniziative che hanno ricevuto più voti ({classifica.length} totali)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-4 sm:px-6">
        <div className="space-y-4">
          {/* Tutte le iniziative sempre visibili */}
          <div className="space-y-3">

            {classifica.map((item, index) => {
              const iniziativa = iniziative.find(i => i.nome === item.nome);
              const isSelected = !!iniziativa && selectedVoti.includes(iniziativa.id);
              const isTopThree = index < 3;
              const titoloBreve = getTitoloBreve(item.nome);

              return (
                <div
                  key={item.nome}
                  className={"group rounded-xl border p-3 sm:p-4 transition-colors " +
                    (isTopThree
                      ? "border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-100"
                      : "border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50") +
                    (onViewIniziativa && iniziativa ? " cursor-pointer" : "")}
                  onClick={() => {
                    if (onViewIniziativa && iniziativa) onViewIniziativa(iniziativa);
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-sm " +
                        (isTopThree
                          ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                          : "bg-gradient-to-br from-blue-400 to-indigo-600")}
                      aria-label={"Posizione " + (index + 1)}
                    >
                      {index + 1}
                    </span>
                    {item.emoji && (
                      <span className="text-xl" role="img" aria-label="Categoria dell'iniziativa">
                        {item.emoji}
                      </span>
                    )}
                  </div>
                  <h4 className={"min-w-0 text-[15px] font-bold leading-snug sm:text-base [overflow-wrap:anywhere] " +
                    (isTopThree ? "text-gray-900" : "text-indigo-900")} title={item.nome}>
                    {item.sitoWeb ? (
                      <a href={item.sitoWeb} target="_blank" rel="noopener noreferrer"
                        className="hover:underline" aria-label={item.nome}
                        onClick={(e) => e.stopPropagation()}>
                        {titoloBreve}
                      </a>
                    ) : titoloBreve}
                  </h4>
                  {iniziativa?.descrizione && (
                    <p className="mt-1 hidden text-sm leading-relaxed text-gray-600 sm:line-clamp-2">
                      {iniziativa.descrizione}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-3 border-t border-gray-300/50 pt-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] leading-tight text-gray-600">Firme raccolte</span>
                        <strong className="text-sm tabular-nums text-gray-800">
                          {(iniziativa?.firme || 0).toLocaleString("it-IT")}
                        </strong>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] leading-tight text-gray-600">Voti DEMOS</span>
                        <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-gray-800">
                          <Trophy className={"h-3.5 w-3.5 " + (isTopThree ? "text-yellow-600" : "text-blue-600")}
                            aria-hidden="true" />
                          {item.voti}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline" size="sm" type="button"
                      aria-pressed={isSelected}
                      aria-label={(isSelected ? "Rimuovi selezione: " : "Seleziona: ") + item.nome}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelezioneClassifica(item.nome);
                      }}
                      disabled={isPending || isBlocked}
                      className={"ml-auto h-9 shrink-0 whitespace-nowrap transition-colors " +
                        (isSelected
                          ? "border-blue-500 bg-blue-100 text-blue-700 hover:bg-blue-200"
                          : isTopThree
                            ? "hover:border-yellow-400 hover:bg-yellow-50 hover:text-yellow-700"
                            : "hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700")}
                    >
                      {isSelected ? (
                        <><ThumbsUp className="mr-1.5 h-4 w-4" aria-hidden="true" />Selezionato</>
                      ) : (
                        <><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />Seleziona</>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
