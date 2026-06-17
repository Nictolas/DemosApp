import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Loader2, MessageSquare } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { useNoScroll } from "@/hooks/useNoScroll";

export default function Opinioni() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Blocca lo scroll della pagina
  useNoScroll(true);

  if (isAuthLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
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
      path: "/opinioni-europee"
    },
    { 
      id: "nazionali", 
      nome: "Opinioni\nNazionali", 
      descrizione: "Temi di rilevanza nazionale",
      color: "green",
      path: "/opinioni-nazionali"
    },
    { 
      id: "regionali", 
      nome: "Opinioni\nRegionali", 
      descrizione: "Temi di rilevanza regionale",
      color: "purple",
      path: "/opinioni-regionali"
    },
    { 
      id: "comunali", 
      nome: "Opinioni\nComunali", 
      descrizione: "Temi di rilevanza comunale",
      color: "orange",
      path: "/opinioni-comunali"
    }
  ];

  return (
    <PageTransition>
                          <div className="min-h-screen flex flex-col overflow-hidden select-none page-with-navbar" style={{ paddingBottom: 'calc(7.5rem + 2rem)' }}>
        <div className="container mx-auto px-4 py-6 flex flex-col h-full">


          <div className="text-center mb-6 flex-shrink-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Le tue Opinioni</h1>
            <p className="text-gray-600">Scegli la categoria di opinioni che vuoi esprimere</p>
          </div>

          {/* Pulsante Proponi Nuova Opinione */}
          <div className="mb-6 flex-shrink-0">
            <button
              type="button"
              className="relative w-full h-32 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform"
              onClick={() => setLocation("/proponi-opinione")}
              onContextMenu={e => e.preventDefault()}
            >
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polygon points="100,0 0,0 0,35 100,20" fill="#fbcfe8" />
                <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
              </svg>
              <div className="relative z-10 flex flex-col items-center justify-center h-full">
                <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                  <MessageSquare className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                  <MessageSquare className="h-8 w-8 text-fuchsia-600 relative z-10" />
                </span>
                <div className="text-gray-700 font-semibold text-lg select-none">Proponi Nuova Opinione</div>
              </div>
            </button>
          </div>

          {/* Griglia 2x2 con card trasformate in pulsanti - altezza ottimizzata */}
          <div className="grid grid-cols-2 gap-4 h-full flex-1">
            {categorie.map((categoria) => {
              const colorMap = { 
                blue: { bg: "#dbeafe", text: "#1e40af", icon: "#2563eb" },
                green: { bg: "#bbf7d0", text: "#166534", icon: "#16a34a" }, 
                purple: { bg: "#ede9fe", text: "#581c87", icon: "#9333ea" }, 
                orange: { bg: "#fef9c3", text: "#92400e", icon: "#ea580c" }
              };
              const color = colorMap[categoria.color as keyof typeof colorMap];
              
              return (
                <button
                  key={categoria.id}
                  type="button"
                  className="opinioni-button relative w-full rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
                  onMouseDown={(e) => {
                    e.currentTarget.classList.add('scale-95', 'shadow-md');
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.classList.remove('scale-95', 'shadow-md');
                    setTimeout(() => setLocation(categoria.path), 100);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.classList.remove('scale-95', 'shadow-md');
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault(); // Previene il comportamento predefinito
                    e.currentTarget.classList.add('scale-95', 'shadow-md');
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault(); // Previene il comportamento predefinito
                    e.currentTarget.classList.remove('scale-95', 'shadow-md');
                    setTimeout(() => setLocation(categoria.path), 100);
                  }}
                  onContextMenu={e => e.preventDefault()}
                >
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon points="100,0 0,0 0,35 100,20" fill={color.bg} />
                    <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 p-4 md:p-6 flex flex-col items-center justify-center h-full">
                    <MessageSquare className="h-12 md:h-16 w-12 md:w-16 mb-3" style={{ color: color.icon }} />
                    <div className="text-2xl md:text-4xl font-bold mb-4 text-center leading-tight whitespace-pre-line" style={{ color: color.text }}>
                      {categoria.nome}
                    </div>
                    <p className="text-lg text-center" style={{ color: color.text }}>
                      {categoria.descrizione}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
