import React from "react";
import { CardHeader } from "@/components/ui/card";

interface MenuHeaderProps {
  canOpenGestisci: boolean;
  onGestisciClick: () => void;
}

export const MenuHeader: React.FC<MenuHeaderProps> = ({
  canOpenGestisci,
  onGestisciClick
}) => {
  return (
    <CardHeader className="text-center flex-shrink-0 pt-3 pb-1">
      {canOpenGestisci ? (
        <button
          type="button"
          onClick={onGestisciClick}
          aria-label="Apri la sezione Gestisci"
          title="Clicca per accedere alla sezione Gestisci"
          className="mx-auto block rounded-full transition-all duration-200 hover:scale-105 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          data-testid="menu-logo"
        >
          <img src="/icona.png" alt="Logo Demos" className="w-24 h-24" />
        </button>
      ) : (
        <img src="/icona.png" alt="Logo Demos" className="w-24 h-24 mx-auto" data-testid="menu-logo" />
      )}
    </CardHeader>
  );
};
