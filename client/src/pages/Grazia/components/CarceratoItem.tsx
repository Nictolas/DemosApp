import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, ThumbsUp, Trophy } from "lucide-react";
import { CarceratoItemProps } from "../types";
import {
  getCarceratoStyle,
  getCarceratoNumberStyle,
  getCarceratoTextStyle,
  getTrophyColor
} from "../utils/graziaUtils";

export const CarceratoItem: React.FC<CarceratoItemProps> = ({
  item,
  index,
  isSelected,
  isTopThree,
  onToggleSelezione,
  disabled
}) => {
  const carceratoStyle = getCarceratoStyle(isTopThree);
  const numberStyle = getCarceratoNumberStyle(isTopThree);
  const textStyle = getCarceratoTextStyle(isTopThree);
  const trophyColor = getTrophyColor(isTopThree);

  return (
    <>
      {/* Compact list row on phones: no large highlighted tiles. */}
      <div className="flex min-h-[58px] min-w-0 items-center gap-2 border-b border-gray-200 bg-white px-2 py-1.5 last:border-b-0 sm:hidden">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${numberStyle}`}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold leading-snug text-gray-900">{item.nome}</p>
          <p className="mt-0.5 text-xs text-gray-500">{item.richieste} richieste</p>
        </div>
        <Button
          variant="outline"
          onClick={() => onToggleSelezione(item.nome)}
          disabled={disabled}
          aria-label={`${isSelected ? "Rimuovi selezione" : "Seleziona"} ${item.nome}`}
          className={`h-11 shrink-0 px-2.5 text-xs ${isSelected
            ? "border-green-500 bg-green-100 text-green-700"
            : "border-blue-200 text-blue-700"
          }`}
        >
          {isSelected ? <ThumbsUp className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
          {isSelected ? "Scelto" : "Seleziona"}
        </Button>
      </div>

      {/* Original richer ranking cards on larger screens. */}
      <div className={`group hidden min-w-0 items-center justify-between gap-4 rounded-xl border p-4 transition-colors sm:flex ${carceratoStyle}`}>
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-md ${numberStyle}`}>
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className={`break-words text-lg font-bold leading-snug text-gray-800 transition-colors ${textStyle}`}>
              {item.nome}
            </h4>
            <p className="mt-1 flex items-center text-sm text-gray-600">
              <Trophy className={`mr-2 h-4 w-4 shrink-0 ${trophyColor}`} />
              {item.richieste} richieste
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleSelezione(item.nome)}
          disabled={disabled}
          className={`shrink-0 transition-colors ${isSelected
            ? "border-green-500 bg-green-100 text-green-700 hover:bg-green-200"
            : "hover:border-yellow-400 hover:bg-yellow-50 hover:text-yellow-700"
          }`}
        >
          {isSelected ? (
            <>
              <ThumbsUp className="mr-2 h-4 w-4" />
              Selezionato
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Seleziona
            </>
          )}
        </Button>
      </div>
    </>
  );
};
