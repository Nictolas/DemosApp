import React from "react";
import { CardHeader } from "@/components/ui/card";

interface MenuHeaderProps {
  isAdmin: boolean;
  onAdminClick: () => void;
}

export const MenuHeader: React.FC<MenuHeaderProps> = ({
  isAdmin,
  onAdminClick
}) => {
  // Debug logging rimosso per evitare re-render
  
  return (
    <CardHeader className="text-center flex-shrink-0 pt-3 pb-1">
      {isAdmin ? (
        <button
          type="button"
          onClick={onAdminClick}
          aria-label="Apri la sezione Gestisci"
          className="mx-auto rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          data-testid="menu-logo"
        >
          <img src="/icona.png" alt="" className="w-24 h-24 hover:opacity-80 hover:scale-105 transition-all duration-200" />
        </button>
      ) : (
        <img src="/icona.png" alt="Logo Demos" className="w-24 h-24 mx-auto" data-testid="menu-logo" />
      )}
    </CardHeader>
  );
};
