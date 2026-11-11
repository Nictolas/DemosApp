import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, ThumbsUp, Trophy, UserRound } from "lucide-react";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
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
  disabled,
  canEditAvatar = false,
  onEditAvatar,
  canManagePublication = false,
  publicationPending = false,
  onTogglePublication
}) => {
  const carceratoStyle = getCarceratoStyle(isTopThree);
  const numberStyle = getCarceratoNumberStyle(isTopThree);
  const textStyle = getCarceratoTextStyle(isTopThree);
  const trophyColor = getTrophyColor(isTopThree);

  const avatarForSize = (size: number) => {
    const portrait = item.avatar_config
      ? <CustomAvatar config={item.avatar_config} size={size} className="overflow-hidden rounded-full" />
      : <span className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-400"><UserRound className="h-1/2 w-1/2" /></span>;
    return canEditAvatar && onEditAvatar ? (
      <button
        type="button"
        onClick={() => onEditAvatar(item.nome)}
        aria-label={`Modifica avatar di ${item.nome}`}
        title={`Modifica avatar di ${item.nome}`}
        className="shrink-0 overflow-hidden rounded-full border border-slate-200 transition hover:ring-2 hover:ring-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ width: size, height: size }}
      >{portrait}</button>
    ) : (
      <div className="shrink-0 overflow-hidden rounded-full border border-slate-200" style={{ width: size, height: size }} aria-hidden="true">
        {portrait}
      </div>
    );
  };

  return (
    <>
      {/* Compact list row on phones: no large highlighted tiles. */}
      <div className="flex min-h-[58px] min-w-0 items-center gap-2 border-b border-gray-200 bg-white px-2 py-1.5 last:border-b-0 sm:hidden">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${numberStyle}`}>
          {index + 1}
        </span>
        {avatarForSize(32)}
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold leading-snug text-gray-900">{item.nome}</p>
          <p className="mt-0.5 text-xs text-gray-500">{item.richieste} richieste</p>
          {canManagePublication && onTogglePublication && (
            <button type="button"
              disabled={publicationPending}
              className="mt-1 text-xs font-semibold text-blue-700 underline disabled:opacity-50"
              onClick={() => onTogglePublication(item)}>
              {item.pubblicato ? "Pubblico · Oscura" : "Solo Admin · Pubblica"}
            </button>
          )}
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
      <div className={`group hidden min-w-0 items-center justify-between gap-2 rounded-xl border p-3 transition-colors sm:flex lg:gap-4 lg:p-4 ${carceratoStyle}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-4">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold lg:h-10 lg:w-10 lg:text-lg text-white shadow-md ${numberStyle}`}>
            {index + 1}
          </div>
          {avatarForSize(36)}
          <div className="min-w-0 flex-1">
            <h4 className={`break-words text-lg font-bold leading-snug text-gray-800 transition-colors ${textStyle}`}>
              {item.nome}
            </h4>
            <p className="mt-1 flex items-center text-sm text-gray-600">
              <Trophy className={`mr-2 h-4 w-4 shrink-0 ${trophyColor}`} />
              {item.richieste} richieste
            </p>
            {canManagePublication && onTogglePublication && (
              <button type="button"
                disabled={publicationPending}
                className="mt-2 text-xs font-semibold text-blue-700 underline disabled:opacity-50"
                onClick={() => onTogglePublication(item)}>
                {item.pubblicato ? "Pubblico · Oscura" : "Solo Admin · Pubblica"}
              </button>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleSelezione(item.nome)}
          disabled={disabled}
          aria-label={`${isSelected ? "Rimuovi selezione" : "Seleziona"} ${item.nome}`}
          title={`${isSelected ? "Rimuovi selezione" : "Seleziona"} ${item.nome}`}
          className={`h-10 w-10 shrink-0 p-0 transition-colors lg:h-auto lg:w-auto lg:px-3 ${isSelected
            ? "border-green-500 bg-green-100 text-green-700 hover:bg-green-200"
            : "hover:border-yellow-400 hover:bg-yellow-50 hover:text-yellow-700"
          }`}
        >
          {isSelected ? (
            <>
              <ThumbsUp className="h-4 w-4 lg:mr-2" />
              <span className="hidden lg:inline">Selezionato</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 lg:mr-2" />
              <span className="hidden lg:inline">Seleziona</span>
            </>
          )}
        </Button>
      </div>
    </>
  );
};
