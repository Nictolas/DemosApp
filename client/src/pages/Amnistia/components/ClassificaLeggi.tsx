import React from "react";
import { Card, CardContent } from "@/components/ui/card";
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
          <p className="mt-3 text-xs text-gray-500">Alcune voci derivano da precedenti normativi storici: non sono iniziative parlamentari attualmente in corso.</p>
        </div>
      </CardContent>
    </Card>
  );
};
