import React from "react";
import { GestisciSection } from "../constants/sections";

interface SectionCardProps {
  section: GestisciSection;
}

export const SectionCard: React.FC<SectionCardProps> = ({ section }) => {
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
      className="menu-button relative w-full min-h-[140px] rounded-xl shadow-lg overflow-hidden cursor-pointer transition-transform hover:shadow-xl"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      data-testid="gestisci-button"
    >
      <div className="absolute inset-0" style={{ backgroundColor: bgColor, opacity: 0.1 }}></div>
      <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: bgColor }}></div>
      <div className="relative z-10 flex flex-col items-center justify-center gap-3 p-4 w-full h-full">
        <span className="relative flex items-center justify-center w-12 h-12 flex-shrink-0">
          <IconComponent className="h-10 w-10" style={{ color: iconColor }} />
        </span>
        <div className="flex-1 text-center">
          <div className="text-gray-900 font-bold text-lg select-none leading-tight mb-1">{section.title}</div>
          <div className="text-gray-600 text-xs select-none line-clamp-2">{section.description}</div>
        </div>
      </div>
    </button>
  );
};
