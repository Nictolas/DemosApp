import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useNoScroll } from "@/hooks/useNoScroll";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Crown, Building2, Scale, Archive, Users, CheckSquare } from "lucide-react";

export default function Vota() {
  const { user, isLoading } = useAuth();
  
  // Blocca lo scroll della pagina
  useNoScroll(true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-50 to-pink-100 p-4 page-with-navbar">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          {/* Header vuoto - pulsante "Torna al Menu" rimosso */}
        </div>

        {/* Titolo */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <Crown className="h-6 w-6 text-purple-600" />
              Vota
            </CardTitle>
            <CardDescription>
              Partecipa alle votazioni democratiche. Seleziona la categoria per esprimere il tuo voto.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Pulsanti Voto - Nuova estetica come Menu */}
        <div className="grid grid-cols-2 gap-6">
          {/* Capo di Stato */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => window.location.href = "/capo-di-stato"}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#ede9fe" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <Crown className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <Crown className="h-8 w-8 text-purple-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">Capo di Stato</div>
            </div>
          </button>
          {/* Governo */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => window.location.href = "/governo"}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#fbcfe8" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <Building2 className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <Building2 className="h-8 w-8 text-pink-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">Governo</div>
            </div>
          </button>
          {/* Grazia */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => window.location.href = "/grazia"}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#bbf7d0" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <Scale className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <Scale className="h-8 w-8 text-green-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">Grazia</div>
            </div>
          </button>
          {/* Amnistia */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => window.location.href = "/amnistia"}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#5eead4" /> {/* teal-300 */}
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <Archive className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <Archive className="h-8 w-8 text-teal-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none">Amnistia</div>
            </div>
          </button>
          {/* Iniziativa Popolare */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => window.location.href = "/vota-iniziativa-popolare"}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#93c5fd" /> {/* blue-300 */}
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <Users className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <Users className="h-8 w-8 text-blue-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none text-center">Iniziativa<br />Popolare</div>
            </div>
          </button>
          {/* Referendum Abrogativo */}
          <button
            type="button"
            className="relative w-full h-40 rounded-2xl shadow-lg active:shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform"
            onClick={() => window.location.href = "/vota-referendum-abrogativo"}
            onContextMenu={e => e.preventDefault()}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="100,0 0,0 0,35 100,20" fill="#fca5a5" /> {/* red-300 */}
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 flex flex-col items-center justify-center h-full">
              <span className="relative flex items-center justify-center w-16 h-16 mb-2">
                <CheckSquare className="h-12 w-12 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
                <CheckSquare className="h-8 w-8 text-red-600 relative z-10" />
              </span>
              <div className="text-gray-700 font-semibold text-lg select-none text-center">Referendum<br />Abrogativo</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
