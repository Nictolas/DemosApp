import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, useLocation } from "wouter";
import { Heart, Users, Star, UserCheck, Building2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { Card } from "@/components/ui/card";

interface PreferitiButtonProps {
  path: string;
  icon: React.ComponentType<any>;
  label: string;
  color: {
    bg: string;
    icon: string;
  };
  onNavigate: (path: string, event: React.MouseEvent<HTMLButtonElement>) => void;
}

const PreferitiButton: React.FC<PreferitiButtonProps> = ({
  path,
  icon: Icon,
  label,
  color,
  onNavigate
}) => {
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.add('scale-95', 'shadow-md');
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
    onNavigate(path, e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('scale-95', 'shadow-md');
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
    onNavigate(path, e as any);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  return (
    <button
      type="button"
      className="menu-button relative w-full rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      data-testid="preferiti-button"
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="100,0 0,0 0,35 100,20" fill={color.bg} />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <span className="relative flex items-center justify-center w-16 h-16 mb-3">
          <Icon className="h-14 w-14 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
          <Icon className="h-10 w-10 relative z-10" style={{ color: color.icon }} />
        </span>
        <div className="text-gray-700 font-semibold text-3xl select-none">{label}</div>
      </div>
    </button>
  );
};

const preferitiItems = [
  {
    id: "politici",
    path: "/rappresentanti",
    icon: Users,
    label: "Politici",
    color: {
      bg: "#dbeafe",
      icon: "#2563eb"
    }
  },
  {
    id: "candidati",
    path: "/candidati",
    icon: Star,
    label: "Candidati",
    color: {
      bg: "#fef3c7",
      icon: "#d97706"
    }
  },
  {
    id: "attivisti",
    path: "/attivisti",
    icon: UserCheck,
    label: "Attivisti",
    color: {
      bg: "#dcfce7",
      icon: "#16a34a"
    }
  },
  {
    id: "organizzazioni",
    path: "/organizzazioni",
    icon: Building2,
    label: "Organizzazioni",
    color: {
      bg: "#f3e8ff",
      icon: "#9333ea"
    }
  }
];

export default function Preferiti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Gestione stati di loading e autenticazione
  if (isAuthLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageContainer>
    );
  }

  // Se non c'è utente e non stiamo caricando, reindirizza al login
  if (!user && !isAuthLoading) {
    return <Redirect to="/auth" />;
  }

  // Se non c'è utente (caso di fallback), reindirizza al login
  if (!user) {
    return <Redirect to="/auth" />;
  }

  const navigateWithButtonReset = (path: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setLocation(path);
  };

  return (
    <PageContainer className="preferiti-page flex flex-col bg-gradient-to-b from-blue-50 to-white select-none">
      <div className="container mx-auto px-4 py-4 flex-1 flex flex-col">
        <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col min-h-0">
          {/* Header */}
          <Card className="w-full">
            <div className="p-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Heart className="h-8 w-8 text-red-500" />
                <h1 className="text-2xl font-bold text-gray-900" data-testid="preferiti-title">Preferiti</h1>
              </div>
              <p className="text-gray-600">
                Scegli la categoria che ti interessa
              </p>
            </div>
          </Card>

          {/* Grid dei pulsanti */}
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
              {preferitiItems.map((item) => (
                <PreferitiButton
                  key={item.id}
                  path={item.path}
                  icon={item.icon}
                  label={item.label}
                  color={item.color}
                  onNavigate={navigateWithButtonReset}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
