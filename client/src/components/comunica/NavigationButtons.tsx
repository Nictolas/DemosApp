import React from "react";
import { NavigationButtonsProps } from "./types";
import { getNavigationButtons } from "./utils";

export function NavigationButtons({ user, onNavigate }: NavigationButtonsProps) {
  const buttons = getNavigationButtons();

  return (
    <div className="grid grid-cols-2 gap-6">
      {buttons.map((button) => {
        // Check if button should be shown for user role
        if (button.showForRoles && !button.showForRoles.includes(user?.ruolo || user?.role)) {
          return null;
        }

        const IconComponent = button.icon;

        return (
          <button
            key={button.id}
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => onNavigate(button.path)}
            onContextMenu={e => e.preventDefault()}
          >
            <svg 
              className="absolute inset-0 w-full h-full" 
              viewBox="0 0 100 100" 
              preserveAspectRatio="none" 
              aria-hidden="true"
            >
              <polygon points="100,0 0,0 0,35 100,20" fill={button.bgColor} />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <IconComponent 
                  className="h-12 w-12 text-white absolute" 
                  style={{ filter: 'drop-shadow(0 0 0 #fff)' }} 
                />
                <IconComponent 
                  className={`h-8 w-8 relative z-10 ${button.color}`} 
                />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">
                {button.title}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
