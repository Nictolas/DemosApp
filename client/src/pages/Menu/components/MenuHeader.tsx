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
      <img 
        src="/icona.png" 
        alt="Logo Demos" 
        className={`w-24 h-24 mx-auto ${isAdmin ? 'cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200' : ''}`}
        onClick={isAdmin ? onAdminClick : undefined}
        data-testid="menu-logo"
        title={isAdmin ? "Clicca per accedere alla sezione Gestisci" : undefined}
      />
    </CardHeader>
  );
};
