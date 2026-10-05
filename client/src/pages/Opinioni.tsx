import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Loader2, MessageSquare } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";

export default function Opinioni() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isAuthLoading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const categorie = [
    {
      id: "europee",
      nome: "Opinioni\nEuropee",
      descrizione: "Temi di rilevanza europea",
      color: "blue",
      path: "/opinioni-europee",
    },
    {
      id: "nazionali",
      nome: "Opinioni\nNazionali",
      descrizione: "Temi di rilevanza nazionale",
      color: "green",
      path: "/opinioni-nazionali",
    },
    {
      id: "regionali",
      nome: "Opinioni\nRegionali",
      descrizione: "Temi di rilevanza regionale",
      color: "purple",
      path: "/opinioni-regionali",
    },
    {
      id: "comunali",
      nome: "Opinioni\nComunali",
      descrizione: "Temi di rilevanza comunale",
      color: "orange",
      path: "/opinioni-comunali",
    },
  ];

  const colorMap = {
    blue: { bg: "#dbeafe", text: "#1e40af", icon: "#2563eb" },
    green: { bg: "#bbf7d0", text: "#166534", icon: "#16a34a" },
    purple: { bg: "#ede9fe", text: "#581c87", icon: "#9333ea" },
    orange: { bg: "#fef9c3", text: "#92400e", icon: "#ea580c" },
  };

  return (
    <PageContainer className="opinioni-page bg-linear-to-b from-fuchsia-50 to-white select-none">
      <div className="opinioni-page__inner flex h-full min-h-0 flex-col px-3 py-2 sm:px-4">
        <div className="text-center mb-3 shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Le tue Opinioni</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Scegli la categoria di opinioni che vuoi esprimere
          </p>
        </div>

        <div className="mb-3 shrink-0">
          <button
            type="button"
            className="relative w-full h-28 sm:h-32 rounded-2xl shadow-lg active:shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => setLocation("/proponi-opinione")}
            onContextMenu={(e) => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#fbcfe8" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 mb-1">
                <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-white absolute" style={{ filter: "drop-shadow(0 0 0 #fff)" }} />
                <MessageSquare className="h-7 w-7 sm:h-8 sm:w-8 text-fuchsia-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-base sm:text-lg select-none">Proponi Nuova Opinione</div>
            </div>
          </button>
        </div>

        <div className="opinioni-page__grid flex-1 min-h-0 gap-2 sm:gap-3">
          {categorie.map((categoria) => {
            const color = colorMap[categoria.color as keyof typeof colorMap];

            return (
              <button
                key={categoria.id}
                type="button"
                className="opinioni-button relative w-full rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
                onMouseDown={(e) => {
                  e.currentTarget.classList.add("scale-95", "shadow-md");
                }}
                onMouseUp={(e) => {
                  e.currentTarget.classList.remove("scale-95", "shadow-md");
                  setTimeout(() => setLocation(categoria.path), 100);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.classList.remove("scale-95", "shadow-md");
                }}
                onTouchStart={(e) => {
                  e.currentTarget.classList.add("scale-95", "shadow-md");
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.classList.remove("scale-95", "shadow-md");
                  setTimeout(() => setLocation(categoria.path), 100);
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points="100,0 0,0 0,35 100,20" fill={color.bg} />
                  <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                </svg>
                <div className="relative z-10 p-3 sm:p-4 flex flex-col items-center justify-center h-full">
                  <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 mb-2" style={{ color: color.icon }} />
                  <div
                    className="text-lg sm:text-2xl font-bold mb-1 text-center leading-tight whitespace-pre-line"
                    style={{ color: color.text }}
                  >
                    {categoria.nome}
                  </div>
                  <p className="text-xs sm:text-sm text-center line-clamp-2" style={{ color: color.text }}>
                    {categoria.descrizione}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
