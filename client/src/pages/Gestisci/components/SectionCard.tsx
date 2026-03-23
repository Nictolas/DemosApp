import React from "react";
import { ChevronRight } from "lucide-react";
import { GestisciSection } from "../constants/sections";

interface SectionCardProps {
  section: GestisciSection;
  compact?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({ section, compact = false }) => {
  const IconComponent = section.icon;

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.add('scale-95', 'shadow-md');
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
    window.location.href = section.route;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('scale-95', 'shadow-md');
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
    window.location.href = section.route;
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  // Estrai i colori dal gradient per creare il colore di sfondo
  const getBackgroundColor = (buttonColor: string) => {
    if (buttonColor.includes('purple')) return '#8b5cf6';
    if (buttonColor.includes('cyan')) return '#06b6d4';
    if (buttonColor.includes('amber')) return '#f59e0b';
    if (buttonColor.includes('red')) return '#ef4444';
    if (buttonColor.includes('emerald')) return '#10b981';
    if (buttonColor.includes('indigo')) return '#6366f1';
    if (buttonColor.includes('blue')) return '#3b82f6';
    if (buttonColor.includes('pink')) return '#ec4899';
    if (buttonColor.includes('slate')) return '#64748b';
    return '#6b7280';
  };

  const getIconColor = (buttonColor: string) => {
    if (buttonColor.includes('purple')) return '#8b5cf6';
    if (buttonColor.includes('cyan')) return '#06b6d4';
    if (buttonColor.includes('amber')) return '#f59e0b';
    if (buttonColor.includes('red')) return '#ef4444';
    if (buttonColor.includes('emerald')) return '#10b981';
    if (buttonColor.includes('indigo')) return '#6366f1';
    if (buttonColor.includes('blue')) return '#3b82f6';
    if (buttonColor.includes('pink')) return '#ec4899';
    if (buttonColor.includes('slate')) return '#64748b';
    return '#6b7280';
  };

  const bgColor = getBackgroundColor(section.buttonColor);
  const iconColor = getIconColor(section.buttonColor);

  return (
    <button
      type="button"
      className={`group relative w-full overflow-hidden cursor-pointer transition-all duration-200 border border-white/50 bg-white/70 backdrop-blur-md hover:bg-white/90 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 rounded-2xl ${
        compact ? "min-h-[56px]" : "min-h-[156px]"
      }`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      data-testid="gestisci-button"
    >
      <div className="absolute inset-0 opacity-10" style={{ backgroundColor: bgColor }} />
      <div
        className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-25 group-hover:opacity-35 transition-opacity"
        style={{ backgroundColor: bgColor }}
      />
      <div className={`relative z-10 w-full h-full ${compact ? "px-3 py-2" : "p-4"}`}>
        <div className={`w-full h-full ${compact ? "flex items-center gap-3" : "flex flex-col justify-between gap-3"}`}>
          <span
            className={`relative flex items-center justify-center flex-shrink-0 rounded-xl ${
              compact ? "w-8 h-8" : "w-14 h-14"
            }`}
            style={{ backgroundColor: `${bgColor}22` }}
          >
            <IconComponent className={compact ? "h-4 w-4" : "h-7 w-7"} style={{ color: iconColor }} />
          </span>
          <div className="flex-1 min-w-0 text-left">
            <div className={`${compact ? "text-[13px]" : "text-base"} text-slate-900 font-semibold leading-tight truncate`}>
              {section.title}
            </div>
            {!compact ? (
              <div className="text-slate-600 text-xs leading-snug line-clamp-2 mt-1">
                {section.description}
              </div>
            ) : (
              <div className="text-slate-500 text-[11px] mt-0.5 truncate">Apri sezione</div>
            )}
          </div>
          {compact && (
            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          )}
          {!compact && (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
              <span>Apri</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
        {!compact && (
          <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: bgColor }} />
        )}
        {compact && (
          <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: bgColor }} />
        )}
        </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5" />
    </button>
  );
};
