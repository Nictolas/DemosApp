import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MessageSquare } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";

export default function Opinioni() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isAuthLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  const categorie = [
    { 
      id: "europee", 
      nome: "Opinioni Europee", 
      descrizione: "Temi di rilevanza europea",
      color: "blue",
      path: "/opinioni-europee"
    },
    { 
      id: "nazionali", 
      nome: "Opinioni Nazionali", 
      descrizione: "Temi di rilevanza nazionale",
      color: "green",
      path: "/opinioni-nazionali"
    },
    { 
      id: "regionali", 
      nome: "Opinioni Regionali", 
      descrizione: "Temi di rilevanza regionale",
      color: "purple",
      path: "/opinioni-regionali"
    },
    { 
      id: "comunali", 
      nome: "Opinioni Comunali", 
      descrizione: "Temi di rilevanza comunale",
      color: "orange",
      path: "/opinioni-comunali"
    }
  ];

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col overflow-hidden select-none" style={{ paddingBottom: '80px' }}>
        <div className="container mx-auto px-4 py-8">


          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Le tue Opinioni</h1>
            <p className="text-gray-600">Scegli la categoria di opinioni che vuoi esprimere</p>
          </div>

          {/* Griglia 2x2 con tutte e 4 le card di dimensioni uguali */}
          <div className="grid grid-cols-2 gap-4 pb-2">
            {categorie.map((categoria) => {
              const colorMap = { 
                blue: { bg: "#dbeafe", text: "#1e40af", icon: "#2563eb" },
                green: { bg: "#bbf7d0", text: "#166534", icon: "#16a34a" }, 
                purple: { bg: "#ede9fe", text: "#581c87", icon: "#9333ea" }, 
                orange: { bg: "#fef9c3", text: "#92400e", icon: "#ea580c" }
              };
              const color = colorMap[categoria.color as keyof typeof colorMap];
              
              return (
                <div key={categoria.id} className="relative w-full rounded-2xl shadow-lg overflow-hidden">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon points="100,0 0,0 0,35 100,20" fill={color.bg} />
                    <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 p-4 md:p-6 flex flex-col items-center justify-center">
                    <MessageSquare className="h-8 md:h-12 w-8 md:w-12 mb-2" style={{ color: color.icon }} />
                    <div className="text-base md:text-xl font-bold mb-1 text-center leading-tight" style={{ color: color.text }}>
                      {categoria.nome}
                    </div>
                    <p className="text-sm text-center mb-3" style={{ color: color.text }}>
                      {categoria.descrizione}
                    </p>
                    <Button 
                      className="px-4 py-2 text-sm"
                      style={{ 
                        backgroundColor: color.icon, 
                        borderColor: color.icon 
                      }}
                      onClick={() => setLocation(categoria.path)}
                    >
                      Esprimi opinioni
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}