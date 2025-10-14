import React from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Trophy } from "lucide-react";
import { LeggeItemProps } from "../types";
import {
  getLeggeStyle,
  getLeggeNumberStyle,
  getLeggeTextStyle,
  getTrophyColor,
  getButtonStyle
} from "../utils/amnistiaUtils";

export const LeggeItem: React.FC<LeggeItemProps> = ({
  item,
  index,
  isTopThree,
  onVote,
  isPending,
  hasReachedLimit
}) => {
  const leggeStyle = getLeggeStyle(isTopThree);
  const numberStyle = getLeggeNumberStyle(isTopThree);
  const textStyle = getLeggeTextStyle(isTopThree);
  const trophyColor = getTrophyColor(isTopThree);
  const buttonStyle = getButtonStyle(isTopThree);

  return (
    <div className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg ${leggeStyle}`}>
      <div className="flex items-center space-x-4">
        <div className={`flex items-center justify-center w-10 h-10 text-white rounded-full font-bold text-lg shadow-md transition-all duration-300 ${numberStyle}`}>
          {index + 1}
        </div>
        <div>
          <h4 className={`font-bold text-gray-800 text-lg transition-colors duration-300 ${textStyle}`}>
            {item.legge}
          </h4>
          <p className="text-sm text-gray-600 flex items-center">
            <Trophy className={`h-4 w-4 mr-2 ${trophyColor}`} />
            {item.voti} voti
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onVote(item.legge)}
        disabled={isPending || hasReachedLimit}
        className={`transition-all duration-300 ${buttonStyle}`}
      >
        <ThumbsUp className="h-4 w-4 mr-2" />
        Vota
      </Button>
    </div>
  );
};
