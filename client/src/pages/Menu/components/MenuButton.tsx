import React from "react";
import { MenuButtonProps } from "../types";
import { useResponsiveLayoutContext } from "@/components/ResponsiveLayoutProvider";

export const MenuButton: React.FC<MenuButtonProps> = ({
  path,
  icon: Icon,
  label,
  color,
  onNavigate
}) => {
  const { getResponsiveClass, deviceInfo } = useResponsiveLayoutContext();
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
      className={getResponsiveClass("menu-button relative w-full rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform", "button")}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      data-testid="menu-button"
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="100,0 0,0 0,35 100,20" fill={color.bg} />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <span className="relative flex items-center justify-center w-16 h-16 mb-3">
          <Icon className="h-14 w-14 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
          <Icon className="h-10 w-10 relative z-10" style={{ color: color.icon }} />
        </span>
        <div className={getResponsiveClass("text-gray-700 font-semibold select-none", "text")}>{label}</div>
      </div>
    </button>
  );
};
