import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, BookOpen, Users } from "lucide-react";
import { useLocation } from "wouter";

export const AccessDenied: React.FC = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-50 to-pink-100 p-4 page-with-navbar">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setLocation("/menu")}
            className="flex items-center gap-2"
          >
            Torna al Menu
          </Button>
        </div>

        {/* Titolo */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              Accesso Limitato
            </CardTitle>
            <CardDescription className="text-lg">
              Questa sezione è riservata ai rappresentanti eletti e ai candidati
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Pulsanti Navigazione - Nuova estetica */}
        <div className="grid grid-cols-2 gap-6">
          {/* Programma (solo Admin/Candidato) */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => setLocation('/programma')}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#e0e7ff" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <BookOpen className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <BookOpen className="h-8 w-8 text-indigo-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">Programma</div>
            </div>
          </button>
          {/* Riscontro (solo per ruoli avanzati) */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => setLocation('/riscontro')}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#fce7f3" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <Users className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <Users className="h-8 w-8 text-pink-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">Riscontro</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
