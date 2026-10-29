import {
  UserRound,
  Megaphone,
  Binoculars,
  PenLine,
  Bell,
  Calendar,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  isVisible?: (userRole?: string) => boolean;
}

function hasAdvancedAccess(userRole?: string): boolean {
  return (
    userRole === "P" ||
    userRole === "C" ||
    userRole === "CP" ||
    userRole === "AD" ||
    userRole === "A" ||
    userRole === "O" ||
    userRole === "I"
  );
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    path: "/profilo",
    label: "Profilo",
    icon: UserRound,
  },
  {
    path: "/eventi",
    label: "Eventi",
    icon: Calendar,
  },
  {
    path: "/firma",
    label: "Firma",
    icon: PenLine,
  },
  {
    path: "/notifiche",
    label: "Notifiche",
    icon: Bell,
  },
  {
    path: "/strumenti",
    label: "Strumenti",
    icon: Megaphone,
    isVisible: (role) => hasAdvancedAccess(role),
  },
  {
    path: "/avvistamenti",
    label: "Avvistamenti",
    icon: Binoculars,
  },
];

export function getVisibleNavItems(userRole?: string): NavItem[] {
  return MAIN_NAV_ITEMS.filter((item) => !item.isVisible || item.isVisible(userRole));
}
