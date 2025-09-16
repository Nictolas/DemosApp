import React from "react";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
    <CardHeader className="text-center flex-shrink-0 pt-6 pb-4">
      <img 
        src="/icona.png" 
        alt="Logo Demos" 
        className={`w-28 h-28 mx-auto mb-4 ${isAdmin ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        onClick={isAdmin ? onAdminClick : undefined}
        data-testid="menu-logo"
      />
      <CardTitle className="text-4xl font-bold text-gray-800 mb-3" data-testid="menu-title">
        Menu Principale
      </CardTitle>
      <CardDescription className="text-gray-600 text-lg">
        Benvenuto nell'applicazione DEMOS.<br />
        Seleziona un'opzione per continuare.
      </CardDescription>
    </CardHeader>
  );
};
