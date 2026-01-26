import React from "react";
import { CardContent } from "@/components/ui/card";
import { MenuButton } from "./MenuButton";
import { menuItems } from "../constants/menuItems";
import { MenuButtonProps } from "../types";

interface MenuGridProps {
  hasAdvancedAccess: boolean;
  hasLimitedAccess: boolean;
  userRole?: string;
  onNavigate: (path: string, event: React.MouseEvent<HTMLButtonElement>) => void;
}

export const MenuGrid: React.FC<MenuGridProps> = ({
  hasAdvancedAccess,
  hasLimitedAccess,
  userRole,
  onNavigate
}) => {
  const visibleItems = menuItems.filter(item => {
    // Se l'utente è Istituzione, nascondi Opinioni, Firma e Vota
    if (userRole === "I") {
      return item.id === "profilo";
    }
    // Nascondi "Opinioni" e "Vota" dal Menu (sono stati spostati nella pagina Preferiti)
    if (item.id === "opinioni" || item.id === "vota") {
      return false;
    }
    // Altrimenti usa la logica esistente
    return !item.requiresAdvancedAccess || hasAdvancedAccess || hasLimitedAccess;
  });

  // Debug logging rimosso per evitare re-render


  return (
    <div className="grid grid-cols-2 gap-3 pb-4" style={{ alignContent: 'start', overflow: 'visible' }}>
      {visibleItems.map((item) => (
        <MenuButton
          key={item.id}
          path={item.path}
          icon={item.icon}
          label={item.label}
          color={item.color}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
};
