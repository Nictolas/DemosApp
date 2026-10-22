import React from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Trophy } from "lucide-react";
import { LeggeItemProps } from "../types";
import {
  getLeggeStyle,
  getLeggeNumberStyle,
  getLeggeTextStyle,
  getTrophyColor,
  getButtonStyle,
  getLeggeEmoji
} from "../utils/amnistiaUtils";

export const LeggeItem: React.FC<LeggeItemProps> = ({
  item,
  index,
  isTopThree,
  onVote,
  isPending,
  hasReachedLimit,
  isSelected = false
}) => {
  const leggeStyle = getLeggeStyle(isTopThree);
  const numberStyle = getLeggeNumberStyle(isTopThree);
  const textStyle = getLeggeTextStyle(isTopThree);
  const trophyColor = getTrophyColor(isTopThree);
  const buttonStyle = getButtonStyle(isTopThree);

  return (
    <article className={["group min-w-0 rounded-2xl border p-3.5 shadow-sm transition-colors transition-shadow duration-200 hover:shadow-md sm:p-4", leggeStyle].join(" ")}>
      {/* Rank and vote count sit above the title, never alongside it. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-sm sm:h-10 sm:w-10 sm:text-lg", numberStyle].join(" ")}>
            {index + 1}
          </span>
          <span className="text-xl" aria-hidden="true">{getLeggeEmoji(item.legge)}</span>
        </div>
        <p className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-gray-600">
          <Trophy className={["h-4 w-4", trophyColor].join(" ")} aria-hidden="true" />
          <span>{item.voti} voti</span>
        </p>
      </div>

      {/* The title and its details use the entire card width, also on phones. */}
      <div className="mt-3 min-w-0">
        <h4 className={["break-words text-[1.075rem] font-bold leading-snug text-gray-900 transition-colors duration-200 sm:text-lg", textStyle].join(" ")}>
          {item.legge}
        </h4>
        {item.articolo && <p className="mt-2 text-sm font-medium leading-relaxed text-gray-600">{item.articolo}</p>}
        {item.descrizione && <p className="mt-2 break-words text-sm leading-relaxed text-gray-600">{item.descrizione}</p>}
        {item.precedente_storico && (
          <p className="mt-2 break-words text-sm leading-relaxed text-amber-800">
            {item.precedente_storico}
            {item.fonte_url?.startsWith("https://") && (
              <> · <a href={item.fonte_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Fonte</a></>
            )}
          </p>
        )}
      </div>

      {/* Keep the action reachable without squeezing or overlapping the title. */}
      <div className="mt-4 flex justify-end border-t border-gray-200/80 pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onVote(item.legge)}
          disabled={isPending || (hasReachedLimit && !isSelected)}
          aria-label={isSelected ? "Rimuovi il voto per " + item.legge : "Vota per " + item.legge}
          className={["min-h-11 shrink-0 px-4 transition-colors duration-200", isSelected
            ? "border-green-500 bg-green-100 text-green-700 shadow-sm hover:bg-green-200"
            : buttonStyle].join(" ")}
        >
          <ThumbsUp className="mr-2 h-4 w-4" aria-hidden="true" />
          {isSelected ? "Votato" : "Vota"}
        </Button>
      </div>
    </article>
  );
};
