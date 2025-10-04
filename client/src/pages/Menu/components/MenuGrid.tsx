import React from "react";
import { CardContent } from "@/components/ui/card";
import { MenuButton } from "./MenuButton";
import { menuItems } from "../constants/menuItems";
import { MenuButtonProps } from "../types";

interface MenuGridProps {
  hasAdvancedAccess: boolean;
  hasLimitedAccess: boolean;
  onNavigate: (path: string, event: React.MouseEvent<HTMLButtonElement>) => void;
}

export const MenuGrid: React.FC<MenuGridProps> = ({
  hasAdvancedAccess,
  hasLimitedAccess,
  onNavigate
}) => {
  const visibleItems = menuItems.filter(item => 
    !item.requiresAdvancedAccess || hasAdvancedAccess || hasLimitedAccess
  );

  // Debug logging rimosso per evitare re-render


  return (
    <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
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
