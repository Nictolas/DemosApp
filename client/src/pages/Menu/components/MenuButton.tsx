import React from "react";
import { MenuButtonProps } from "../types";

export const MenuButton: React.FC<MenuButtonProps> = ({
  path,
  icon: Icon,
  label,
  color,
  onNavigate
}) => {
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.add('scale-95', 'shadow-md');
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
    onNavigate(path, e);
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
    onNavigate(path, e as any);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  return (
    <button
      type="button"
      className="relative w-full h-40 md:h-32 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="100,0 0,0 0,35 100,20" fill={color.bg} />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <span className="relative flex items-center justify-center w-12 h-12 mb-2">
          <Icon className="h-10 w-10 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
          <Icon className="h-6 w-6 relative z-10" style={{ color: color.icon }} />
        </span>
        <div className="text-gray-700 font-semibold text-lg select-none">{label}</div>
      </div>
    </button>
  );
};
