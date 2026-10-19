import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink, Plus, Trophy } from "lucide-react";
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

// Queste etichette riguardano soltanto la presentazione: il titolo ufficiale
// rimane invariato nei dati, nella selezione e nella scheda di dettaglio.
const titoloCompatto = (nome: string): string => {
  const normalized = nome.toLocaleLowerCase("it-IT");
  if (normalized.includes("accisa generale sui prodotti da fumo e nicotina")) {
    return "Accise su tabacco e nicotina per la sanità pubblica";
  }
  if (normalized.includes("divieto progressivo delle gabbie negli allevamenti")) {
    return "Stop alle gabbie negli allevamenti";
  }
  if (normalized.includes("26 ottobre 1972") && normalized.includes("igiene femminile")) {
    return "IVA ridotta sui prodotti per l’igiene mestruale e la prima infanzia";
  }
  return nome;
};

export const IniziativeRanking: React.FC<IniziativeRankingProps> = ({
  classifica,
  iniziative,
  selectedVoti,
  onToggleSelezioneClassifica,
  onViewIniziativa,
  isBlocked,
  isPending,
  hasReachedLimit,
}) => {
  if (!classifica || classifica.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Classifica Iniziative Popolari</span>
          </CardTitle>
          <CardDescription>Le iniziative che hanno ricevuto più voti (0 totali)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center text-gray-500">
            <div className="mx-auto mb-6 flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-300">
              <Trophy className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-600">Nessuna classifica disponibile al momento</p>
            <p className="mt-2 text-sm text-gray-500">Riprova più tardi</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const iniziativeByNome = new Map(iniziative.map((iniziativa) => [iniziativa.nome, iniziativa]));

  return (
    <Card className="min-w-0 bg-white">
      <CardHeader className="px-3 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Classifica Iniziative Popolari</span>
        </CardTitle>
        <CardDescription>
          Le iniziative che hanno ricevuto più voti ({classifica.length} totali)
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 px-3 sm:px-6">
        <div className="space-y-3">
          {classifica.map((item, index) => {
            const iniziativa = iniziativeByNome.get(item.nome);
            const isSelected = !!iniziativa && selectedVoti.includes(iniziativa.id);
            const selectionDisabled = isPending || isBlocked || (hasReachedLimit && !isSelected);
            const topThree = index < 3;

            return (
              <div
                key={item.nome}
                className={`min-w-0 rounded-xl border p-3 transition-colors sm:p-4 ${
                  topThree
                    ? "border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-100"
                    : "border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50"
                } ${isSelected ? "ring-2 ring-blue-400 ring-offset-1" : ""}`}
              >
                <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${
                      topThree
                        ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                        : "bg-gradient-to-br from-blue-400 to-indigo-600"
                    }`} aria-label={`Posizione ${index + 1}`}>
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Iniziativa popolare
                    </span>
                  </div>
                  {item.emoji && (
                    <span className="shrink-0 text-xl" role="img" aria-label="Categoria iniziativa">
                      {item.emoji}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  {onViewIniziativa && iniziativa ? (
                    <button
                      type="button"
                      onClick={() => onViewIniziativa(iniziativa)}
                      className="block w-full min-w-0 text-left text-base font-bold leading-snug text-gray-900 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:text-lg"
                      title={item.nome}
                      aria-label={`Dettagli: ${item.nome}`}
                    >
                      <span className="line-clamp-3 break-words">{titoloCompatto(item.nome)}</span>
                    </button>
                  ) : (
                    <h4 className="line-clamp-3 break-words text-base font-bold leading-snug text-gray-900 sm:text-lg" title={item.nome}>
                      {titoloCompatto(item.nome)}
                    </h4>
                  )}
                  {iniziativa?.descrizione && (
                    <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-gray-600 sm:text-sm">
                      {iniziativa.descrizione}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-gray-900/10 pt-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="text-xs text-gray-600">
                      <span className="block">Firme raccolte</span>
                      <strong className="text-sm text-gray-800">
                        {(iniziativa?.firme || 0).toLocaleString("it-IT")}
                      </strong>
                    </div>
                    <div className="text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Trophy className={`h-3.5 w-3.5 ${topThree ? "text-yellow-600" : "text-blue-600"}`} />
                        Voti DEMOS
                      </span>
                      <strong className="text-sm text-gray-800">{item.voti}</strong>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleSelezioneClassifica(item.nome)}
                    disabled={selectionDisabled}
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? "Deseleziona" : "Seleziona"}: ${item.nome}`}
                    className={`h-9 shrink-0 gap-1.5 whitespace-nowrap px-3 text-sm font-semibold ${
                      isSelected
                        ? "border-blue-500 bg-blue-100 text-blue-800 hover:bg-blue-200"
                        : topThree
                          ? "border-yellow-300 bg-white/70 text-gray-900 hover:bg-yellow-50"
                          : "border-blue-200 bg-white/70 text-gray-900 hover:bg-blue-50"
                    }`}
                  >
                    {isSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {isSelected ? "Selezionata" : "Seleziona"}
                  </Button>
                </div>

                {(onViewIniziativa && iniziativa || item.sitoWeb) && (
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    {onViewIniziativa && iniziativa && (
                      <button
                        type="button"
                        className="font-medium text-blue-800 underline-offset-2 hover:underline"
                        onClick={() => onViewIniziativa(iniziativa)}
                      >
                        Leggi il titolo completo e i dettagli
                      </button>
                    )}
                    {item.sitoWeb && (
                      <a
                        href={item.sitoWeb}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-800 underline-offset-2 hover:underline"
                      >
                        Fonte <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
