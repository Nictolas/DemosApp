import { BarChart2, Megaphone, FileText } from "lucide-react";

export const menuItems = [
  {
    id: "elezioni",
    path: "/elezioni",
    icon: BarChart2,
    label: "Elezioni",
    color: {
      bg: "#fef9c3",
      icon: "#ca8a04"
    }
  },
  {
    id: "strumenti",
    path: "/strumenti",
    icon: Megaphone,
    label: "Strumenti",
    color: {
      bg: "#ede9fe",
      icon: "#9333ea"
    },
    requiresAdvancedAccess: true
  },
  {
    id: "eventi",
    path: "/eventi",
    icon: Megaphone,
    label: "Eventi",
    color: {
      bg: "#fbcfe8",
      icon: "#db2777"
    }
  },
  {
    id: "proponi",
    path: "/proponi",
    icon: FileText,
    label: "Proponi",
    color: {
      bg: "#fef9c3",
      icon: "#ca8a04"
    }
  }
];
