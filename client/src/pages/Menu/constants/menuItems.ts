import { FileText, Vote, MessageSquare, User } from "lucide-react";

export const menuItems = [
  {
    id: "profilo",
    path: "/profilo",
    icon: User,
    label: "Profilo",
    color: {
      bg: "#fef3c7",
      icon: "#d97706"
    }
  },
  {
    id: "opinioni",
    path: "/opinioni",
    icon: MessageSquare,
    label: "Opinioni",
    color: {
      bg: "#e0f2fe",
      icon: "#0891b2"
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
