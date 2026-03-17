import React from "react";
import { useLocation } from "wouter";
import { Megaphone, Calendar, BookOpen, Users, MessageSquare } from "lucide-react";
import { NavigationButton } from "../types";

interface NavigationButtonsProps {
  canAccessProgramma: boolean;
}

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({ canAccessProgramma }) => {
  const [, setLocation] = useLocation();

  const navigationButtons: NavigationButton[] = [
    {
      id: "votazione",
      title: "Votazione",
      icon: Megaphone,
      color: "blue",
      route: "/comunica",
      svgPath: "100,0 0,0 0,35 100,20",
      svgFill: "#dbeafe"
    },
    {
      id: "evento",
      title: "Evento",
      icon: Calendar,
      color: "green",
      route: "/evento",
      svgPath: "100,0 0,0 0,35 100,20",
      svgFill: "#bbf7d0"
    },
    {
      id: "programma",
      title: "Programma",
      icon: BookOpen,
      color: "indigo",
      route: "/programma",
      requiresRole: ["AD", "C", "Candidato Politico"],
      svgPath: "100,0 0,0 0,35 100,20",
      svgFill: "#e0e7ff"
    },
    {
      id: "riscontro",
      title: "Riscontro",
      icon: Users,
      color: "pink",
      route: "/riscontro",
      svgPath: "100,0 0,0 0,35 100,20",
      svgFill: "#fce7f3"
    },
    {
      id: "sondaggi",
      title: "Sondaggi",
      icon: MessageSquare,
      color: "yellow",
      route: "/sondaggi",
      svgPath: "100,0 0,0 0,35 100,20",
      svgFill: "#fef9c3"
    }
  ];

  const getIconColor = (color: string) => {
    const colors = {
      blue: "text-blue-600",
      green: "text-green-600",
      indigo: "text-indigo-600",
      pink: "text-pink-600",
      yellow: "text-yellow-600"
    };
    return colors[color as keyof typeof colors] || "text-gray-600";
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {navigationButtons.map((button) => {
        // Skip programma if user doesn't have access
        if (button.id === "programma" && !canAccessProgramma) {
          return null;
        }

        const IconComponent = button.icon;
        const iconColor = getIconColor(button.color);

        return (
          <button
            key={button.id}
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => setLocation(button.route)}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points={button.svgPath} fill={button.svgFill} />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <IconComponent className={`h-12 w-12 text-white absolute`} style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <IconComponent className={`h-8 w-8 ${iconColor} relative z-10`} />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">{button.title}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
