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
      className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg ${carceratoStyle}`}
    >
      <div className="flex items-center space-x-4">
        <div className={`flex items-center justify-center w-10 h-10 text-white rounded-full font-bold text-lg shadow-md transition-all duration-300 ${numberStyle}`}>
          {index + 1}
        </div>
        <div>
          <h4 className={`font-bold text-gray-800 text-lg transition-colors duration-300 ${textStyle}`}>
            {item.nome}
          </h4>
          <p className="text-sm text-gray-600 flex items-center">
            <Trophy className={`h-4 w-4 mr-2 ${trophyColor}`} />
            {item.richieste} richieste
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onToggleSelezione(item.nome)}
        disabled={disabled}
        className={`transition-all duration-300 ${
          isSelected 
            ? "bg-green-100 border-green-500 text-green-700 hover:bg-green-200 shadow-md" 
            : "hover:bg-yellow-50 hover:border-yellow-400 hover:text-yellow-700"
        }`}
      >
        {isSelected ? (
          <>
            <ThumbsUp className="h-4 w-4 mr-2" />
            Selezionato
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            Seleziona
          </>
        )}
      </Button>
    </div>
  );
};
