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
    <div 
      className={`group flex min-w-0 items-center justify-between gap-2 rounded-xl border p-3 transition-colors sm:gap-4 sm:p-4 ${carceratoStyle}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm sm:h-10 sm:w-10 sm:text-lg sm:shadow-md ${numberStyle}`}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className={`break-words text-sm font-bold leading-snug text-gray-800 transition-colors sm:text-lg ${textStyle}`}>
            {item.nome}
          </h4>
          <p className="mt-1 flex items-center text-xs text-gray-600 sm:text-sm">
            <Trophy className={`mr-1 h-3.5 w-3.5 shrink-0 sm:mr-2 sm:h-4 sm:w-4 ${trophyColor}`} />
            {item.richieste} richieste
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onToggleSelezione(item.nome)}
        disabled={disabled}
        className={`h-11 shrink-0 px-2 text-xs transition-colors sm:h-9 sm:px-3 sm:text-sm ${
          isSelected 
            ? "bg-green-100 border-green-500 text-green-700 hover:bg-green-200 shadow-md" 
            : "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700"
        }`}
      >
        {isSelected ? (
          <>
            <ThumbsUp className="mr-1 h-4 w-4 sm:mr-2" />
            Selezionato
          </>
        ) : (
          <>
            <Plus className="mr-1 h-4 w-4 sm:mr-2" />
            Seleziona
          </>
        )}
      </Button>
    </div>
  );
};
