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
    if (buttonColor.includes('blue')) return '#3b82f6';
    if (buttonColor.includes('amber')) return '#f59e0b';
    if (buttonColor.includes('green')) return '#10b981';
    if (buttonColor.includes('indigo')) return '#6366f1';
    return '#6b7280';
  };

  const getIconColor = (buttonColor: string) => {
    if (buttonColor.includes('purple')) return '#8b5cf6';
    if (buttonColor.includes('blue')) return '#3b82f6';
    if (buttonColor.includes('amber')) return '#f59e0b';
    if (buttonColor.includes('green')) return '#10b981';
    if (buttonColor.includes('indigo')) return '#6366f1';
    return '#6b7280';
  };

  const bgColor = getBackgroundColor(section.buttonColor);
  const iconColor = getIconColor(section.buttonColor);

  return (
    <button
      type="button"
      className="menu-button relative w-full rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      data-testid="gestisci-button"
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="100,0 0,0 0,35 100,20" fill={bgColor} />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-4">
        <span className="relative flex items-center justify-center w-16 h-16 mb-3">
          <IconComponent className="h-14 w-14 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
          <IconComponent className="h-10 w-10 relative z-10" style={{ color: iconColor }} />
        </span>
        <div className="text-gray-700 font-semibold text-2xl select-none text-center leading-tight">{section.title}</div>
      </div>
    </button>
  );
};
