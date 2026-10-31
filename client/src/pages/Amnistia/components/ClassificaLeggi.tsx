import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { Classifica } from "../types";
import { LeggeItem } from "./LeggeItem";
import {
  isTopThree
} from "../utils/amnistiaUtils";

interface ClassificaLeggiProps {
  classifica: Classifica[];
  showAllClassifica: boolean;
  isPending: boolean;
  onVote: (legge: string) => void;
  onShowClassifica: () => void;
  hasReachedLimit: boolean;
  mieiVoti?: string[];
  proposalForm?: React.ReactNode;
}

export const ClassificaLeggi: React.FC<ClassificaLeggiProps> = ({
  classifica,
  showAllClassifica,
  isPending,
  onVote,
  onShowClassifica,
  hasReachedLimit,
  mieiVoti = [],
  proposalForm
}) => {
  if (!classifica || classifica.length === 0) {
    return (
      <Card className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Classifica Reati</span>
          </CardTitle>
          <CardDescription>
            I reati che hanno ricevuto più richieste di amnistia (0 totali)
          </CardDescription>
        </CardHeader>
        <CardContent className="app-page-scroll min-h-0 flex-1 overflow-y-auto p-3" role="region" aria-label="Lista reati Amnistia" tabIndex={0}>
          {proposalForm}
          <div className="text-center py-12 text-gray-500">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Trophy className="h-10 w-10 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-600">Nessuna classifica disponibile al momento</p>
            <p className="text-sm text-gray-500 mt-2">Riprova più tardi</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-0 bg-white shadow-sm lg:shadow-lg">
      <CardHeader className="shrink-0 border-b border-yellow-100 bg-gradient-to-r from-yellow-50 to-amber-50 px-2 py-2 lg:p-4">
        <CardTitle className="flex items-center gap-2 text-base lg:text-xl">
          <div className="rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 p-1 lg:p-2">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-yellow-600 to-amber-700 bg-clip-text text-transparent font-bold">
            Classifica Reati
          </span>
        </CardTitle>
        <CardDescription className="sr-only lg:not-sr-only lg:mt-2 lg:text-gray-600">
          I reati che hanno ricevuto più richieste di amnistia ({classifica.length} totali)
        </CardDescription>
        <p className="sr-only lg:not-sr-only lg:mt-2 lg:text-xs lg:text-gray-600">Alcune voci derivano da precedenti normativi storici: non sono iniziative parlamentari attualmente in corso.</p>
      </CardHeader>
      <CardContent className="app-page-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 lg:p-4" role="region" aria-label="Lista reati Amnistia" tabIndex={0}>
        {proposalForm}
        <div className="space-y-2 lg:space-y-4">
          {/* Tutti i reati visibili, ordinate per voti */}
          <div className="space-y-2 lg:space-y-3">
            {classifica.map((item, index) => (
              <LeggeItem
                key={item.legge}
                item={item}
                index={index}
                isTopThree={isTopThree(index)}
                onVote={onVote}
                isPending={isPending}
                hasReachedLimit={hasReachedLimit}
                isSelected={mieiVoti.includes(item.legge)}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
