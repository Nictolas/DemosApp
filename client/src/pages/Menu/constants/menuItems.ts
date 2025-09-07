import { BarChart2, Megaphone, FileText, Vote } from "lucide-react";

export const menuItems = [
  {
    id: "candidati",
    path: "/candidati",
    icon: BarChart2,
    label: "Candidati",
    color: {
      bg: "#fef9c3",
      icon: "#ca8a04"
    }
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
      bg: "#f0f9ff",
      icon: "#0284c7"
    }
  },
  {
    id: "vota",
    path: "/vota",
    icon: Vote,
    label: "Vota",
    color: {
      bg: "#dcfce7",
      icon: "#16a34a"
    }
  }
];
