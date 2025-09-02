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
  return (
    <CardHeader className="text-center flex-shrink-0 pt-6 pb-4">
      <img 
        src="/icona.png" 
        alt="Logo Demos" 
        className={`w-20 h-20 mx-auto mb-3 ${isAdmin ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        onClick={isAdmin ? onAdminClick : undefined}
      />
      <CardTitle className="text-2xl font-bold text-gray-800 mb-2">
        Menu Principale
      </CardTitle>
      <CardDescription className="text-gray-600">
        Benvenuto nell'applicazione DEMOS. Seleziona un'opzione per continuare.
      </CardDescription>
    </CardHeader>
  );
};
