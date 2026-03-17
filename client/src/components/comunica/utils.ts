import { Megaphone, Calendar, BookOpen, Users, CheckCircle, MessageSquare } from "lucide-react";
import { NavigationButton } from "./types";

// Generate zona based on user's election data
export const generateZona = (user: any): string => {
  if (!user) return "";
  
  const { grado_elezione, comune_elezione, provincia_elezione, regione_elezione, paese_elezione } = user;
  
  if (grado_elezione === "CO" && comune_elezione) {
    return `Comune di ${comune_elezione}`;
  } else if (grado_elezione === "P" && provincia_elezione) {
    return `Provincia di ${provincia_elezione}`;
  } else if (grado_elezione === "R" && regione_elezione) {
    return `Regione ${regione_elezione}`;
  } else if (grado_elezione === "N" && paese_elezione) {
    return `Parlamento ${paese_elezione === "Italia" ? "Italiano" : paese_elezione}`;
  } else if (grado_elezione === "E") {
    return "Parlamento Europeo";
  }
  
  return "";
};

// Check if user has advanced access
export const hasAdvancedAccess = (user: any): boolean => {
  const userRole = user?.ruolo;
  return userRole === "P" || userRole === "C" || userRole === "CP" || userRole === "AD";
};

// Get user role
export const getUserRole = (user: any): string => {
  return user?.ruolo || 'Non definito';
};

// Navigation buttons configuration
export const getNavigationButtons = (): NavigationButton[] => [
  {
    id: "votazione",
    title: "Votazione",
    path: "/votazione",
    icon: Megaphone,
    color: "text-blue-600",
    bgColor: "#dbeafe"
  },
  {
    id: "evento",
    title: "Evento",
    path: "/evento",
    icon: Calendar,
    color: "text-green-600",
    bgColor: "#bbf7d0"
  },
  {
    id: "programma",
    title: "Programma",
    path: "/programma",
    icon: BookOpen,
    color: "text-purple-600",
    bgColor: "#ede9fe",
    showForRoles: ["AD", "C", "Candidato Politico"]
  },
  {
    id: "sostenitori",
    title: "Sostenitori",
    path: "/sostenitori",
    icon: Users,
    color: "text-pink-600",
    bgColor: "#fbcfe8",
    showForRoles: ["P", "C", "CP", "Admin"]
  },
  {
    id: "riscontro",
    title: "Riscontro",
    path: "/riscontro",
    icon: CheckCircle,
    color: "text-indigo-600",
    bgColor: "#c7d2fe"
  },
  {
    id: "sondaggi",
    title: "Sondaggi",
    path: "/sondaggi",
    icon: MessageSquare,
    color: "text-yellow-600",
    bgColor: "#fef3c7"
  }
];

// Get badge variant based on vote
export const getVoteBadgeVariant = (vote: "Favorevole" | "Contrario" | "Astenuto") => {
  switch (vote) {
    case "Favorevole":
      return "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400";
    case "Contrario":
      return "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400";
    case "Astenuto":
      return "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400";
    default:
      return "border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-400";
  }
};
